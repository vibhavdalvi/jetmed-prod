// @ts-nocheck
import { Client } from '@elastic/elasticsearch';
import config from './index.js';

const elasticsearchClient = new Client({
  node: config.elasticsearch.node,
  auth: config.elasticsearch.auth,
  maxRetries: 0,
  requestTimeout: 1200,
});

let elasticsearchAvailable = true;
let reconnectAfterMs = 0;
const ES_RECONNECT_COOLDOWN_MS = 30000;

const canUseElasticsearch = () => {
  return elasticsearchAvailable || Date.now() >= reconnectAfterMs;
};

const markElasticsearchUnavailable = (error: unknown) => {
  elasticsearchAvailable = false;
  reconnectAfterMs = Date.now() + ES_RECONNECT_COOLDOWN_MS;
  console.warn('Elasticsearch unavailable. Falling back to database search.', error);
};

export const connectElasticsearch = async (): Promise<void> => {
  try {
    const health = await elasticsearchClient.cluster.health({});
    elasticsearchAvailable = true;
    reconnectAfterMs = 0;
    console.log(`✅ Elasticsearch connected - Cluster status: ${health.status}`);
    
    // Create indices if they don't exist
    await createIndices();
  } catch (error) {
    markElasticsearchUnavailable(error);
    // Don't exit process, Elasticsearch is optional for basic functionality
  }
};

const createIndices = async (): Promise<void> => {
  const indices = [
    {
      index: 'medicines',
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            medicine_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'medicine_synonyms'],
            },
            autocomplete_analyzer: {
              type: 'custom',
              tokenizer: 'autocomplete_tokenizer',
              filter: ['lowercase'],
            },
          },
          tokenizer: {
            autocomplete_tokenizer: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 20,
              token_chars: ['letter', 'digit'],
            },
          },
          filter: {
            medicine_synonyms: {
              type: 'synonym',
              synonyms: [
                'paracetamol, acetaminophen, tylenol',
                'ibuprofen, advil, motrin',
                'aspirin, bayer',
              ],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'medicine_analyzer',
            fields: {
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'standard',
              },
              keyword: { type: 'keyword' },
            },
          },
          genericName: {
            type: 'text',
            analyzer: 'medicine_analyzer',
            fields: {
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'standard',
              },
              keyword: { type: 'keyword' },
            },
          },
          description: { type: 'text', analyzer: 'medicine_analyzer' },
          manufacturer: { type: 'keyword' },
          category: { type: 'keyword' },
          subcategory: { type: 'keyword' },
          type: { type: 'keyword' },
          prescriptionRequirement: { type: 'keyword' },
          activeIngredients: { type: 'keyword' },
          uses: { type: 'text' },
          sideEffects: { type: 'text' },
          price: { type: 'float' },
          inStock: { type: 'boolean' },
          isVegan: { type: 'boolean' },
          isSugarFree: { type: 'boolean' },
          isAlcoholFree: { type: 'boolean' },
          isPregnancySafe: { type: 'boolean' },
          isLactationSafe: { type: 'boolean' },
          isGlutenFree: { type: 'boolean' },
          ageRestriction: { type: 'integer' },
          rating: { type: 'float' },
          popularity: { type: 'integer' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    },
  ];

  for (const indexConfig of indices) {
    try {
      const exists = await elasticsearchClient.indices.exists({
        index: indexConfig.index,
      });

      if (!exists) {
        await elasticsearchClient.indices.create({
          index: indexConfig.index,
          settings: indexConfig.settings,
          mappings: indexConfig.mappings,
        });
        console.log(`✅ Created Elasticsearch index: ${indexConfig.index}`);
      }
    } catch (error) {
      console.error(`Error creating index ${indexConfig.index}:`, error);
    }
  }
};

// Search medicines
export const searchMedicines = async (
  query: string,
  filters?: {
    category?: string;
    type?: string;
    prescriptionRequirement?: string;
    priceMin?: number;
    priceMax?: number;
    inStockOnly?: boolean;
    isVegan?: boolean;
    isSugarFree?: boolean;
    isAlcoholFree?: boolean;
    isPregnancySafe?: boolean;
    isLactationSafe?: boolean;
    isGlutenFree?: boolean;
  },
  pagination?: {
    page?: number;
    limit?: number;
  },
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  }
) => {
  if (!canUseElasticsearch()) {
    throw new Error('Elasticsearch unavailable');
  }

  const { page = 1, limit = 20 } = pagination || {};
  const from = (page - 1) * limit;

  const must: any[] = [];
  const filter: any[] = [];

  // Text search
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: [
          'name^3',
          'name.autocomplete^2',
          'genericName^2',
          'genericName.autocomplete',
          'description',
          'uses',
          'activeIngredients',
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  // Filters
  if (filters) {
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }
    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }
    if (filters.prescriptionRequirement) {
      filter.push({ term: { prescriptionRequirement: filters.prescriptionRequirement } });
    }
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      const range: any = { price: {} };
      if (filters.priceMin !== undefined) range.price.gte = filters.priceMin;
      if (filters.priceMax !== undefined) range.price.lte = filters.priceMax;
      filter.push({ range });
    }
    if (filters.inStockOnly) {
      filter.push({ term: { inStock: true } });
    }
    if (filters.isVegan) {
      filter.push({ term: { isVegan: true } });
    }
    if (filters.isSugarFree) {
      filter.push({ term: { isSugarFree: true } });
    }
    if (filters.isAlcoholFree) {
      filter.push({ term: { isAlcoholFree: true } });
    }
    if (filters.isPregnancySafe) {
      filter.push({ term: { isPregnancySafe: true } });
    }
    if (filters.isLactationSafe) {
      filter.push({ term: { isLactationSafe: true } });
    }
    if (filters.isGlutenFree) {
      filter.push({ term: { isGlutenFree: true } });
    }
  }

  // Sorting
  const sortConfig: any[] = [];
  if (sort) {
    sortConfig.push({ [sort.field]: { order: sort.order } });
  } else if (!query) {
    // Default sort by popularity if no search query
    sortConfig.push({ popularity: { order: 'desc' } });
  }
  // Always add _score for relevance when searching
  if (query) {
    sortConfig.unshift({ _score: { order: 'desc' } });
  }

  try {
    const response = await elasticsearchClient.search({
      index: 'medicines',
      from,
      size: limit,
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: sortConfig,
      highlight: {
        fields: {
          name: {},
          genericName: {},
          description: {},
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
    });

    return {
      hits: response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
        _highlight: hit.highlight,
      })),
      total: typeof response.hits.total === 'object' 
        ? response.hits.total.value 
        : response.hits.total,
      page,
      limit,
    };
  } catch (error) {
    markElasticsearchUnavailable(error);
    throw error;
  }
};

// Autocomplete suggestions
export const getAutocompleteSuggestions = async (query: string, limit = 10) => {
  if (!canUseElasticsearch()) {
    return [];
  }

  try {
    const response = await elasticsearchClient.search({
      index: 'medicines',
      size: limit,
      query: {
        bool: {
          should: [
            {
              match: {
                'name.autocomplete': {
                  query,
                  boost: 2,
                },
              },
            },
            {
              match: {
                'genericName.autocomplete': {
                  query,
                },
              },
            },
          ],
        },
      },
      _source: ['id', 'name', 'genericName', 'type', 'category'],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    markElasticsearchUnavailable(error);
    return [];
  }
};

// Index a medicine document
export const indexMedicine = async (medicine: any) => {
  if (!canUseElasticsearch()) {
    return;
  }

  try {
    await elasticsearchClient.index({
      index: 'medicines',
      id: medicine.id,
      document: medicine,
      refresh: true,
    });
  } catch (error) {
    markElasticsearchUnavailable(error);
  }
};

// Update a medicine document
export const updateMedicineIndex = async (id: string, updates: any) => {
  if (!canUseElasticsearch()) {
    return;
  }

  try {
    await elasticsearchClient.update({
      index: 'medicines',
      id,
      doc: updates,
      refresh: true,
    });
  } catch (error) {
    markElasticsearchUnavailable(error);
  }
};

// Delete a medicine document
export const deleteMedicineIndex = async (id: string) => {
  if (!canUseElasticsearch()) {
    return;
  }

  try {
    await elasticsearchClient.delete({
      index: 'medicines',
      id,
      refresh: true,
    });
  } catch (error) {
    markElasticsearchUnavailable(error);
  }
};

// Alias for backward compatibility
export const deleteMedicineFromIndex = deleteMedicineIndex;

export default elasticsearchClient;
