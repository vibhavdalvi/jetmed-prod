const API_URL = process.env.SMOKE_API_URL || 'http://localhost:5000/api/v1';

const checks = [];

const logResult = (name, ok, detail = '') => {
  const icon = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${icon}: ${name}${suffix}`);
  checks.push(ok);
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
};

const roleCredentials = [
  ['Customer', 'customer@jetmed.com', 'Password123'],
  ['Pharmacist', 'pharmacist@jetmed.com', 'Password123'],
  ['Delivery', 'delivery@jetmed.com', 'Password123'],
  ['Warehouse', 'warehouse@jetmed.com', 'Password123'],
  ['Admin', 'admin@jetmed.com', 'Admin@123'],
];

const run = async () => {
  console.log(`Running smoke tests against ${API_URL}`);

  for (const [role, email, password] of roleCredentials) {
    const { response, json } = await requestJson(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    logResult(`${role} login`, response.ok && json.success === true, json.message || `status ${response.status}`);
  }

  const medicines = await requestJson(`${API_URL}/medicines?limit=5`);
  const medicineCount = medicines.json?.data?.medicines?.length || 0;
  logResult('Medicines listing', medicines.response.ok && medicineCount > 0, `${medicineCount} returned`);

  const categories = await requestJson(`${API_URL}/medicines/categories`);
  const categoryCount = categories.json?.data?.categories?.length || 0;
  logResult('Medicine categories', categories.response.ok && categoryCount > 0, `${categoryCount} returned`);

  const priceSorted = await requestJson(`${API_URL}/medicines?sort=price_low&limit=5`);
  const prices = (priceSorted.json?.data?.medicines || []).map((m) => m?.dosageOptions?.[0]?.price).filter((p) => typeof p === 'number');
  const monotonic = prices.every((price, idx) => idx === 0 || price >= prices[idx - 1]);
  logResult('Price low-high sorting', priceSorted.response.ok && monotonic, JSON.stringify(prices));

  const health = await requestJson(`${API_URL.replace('/api/v1', '')}/health/ready`);
  logResult('System readiness endpoint', health.response.ok, health.json.status || `status ${health.response.status}`);

  const passed = checks.every(Boolean);
  console.log('');
  console.log(passed ? 'Smoke test passed.' : 'Smoke test failed.');
  process.exit(passed ? 0 : 1);
};

run().catch((error) => {
  console.error('Smoke test execution error:', error);
  process.exit(1);
});
