// @ts-nocheck
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectMongoDB } from '../config/mongodb.js';
import { User, UserProfile, Address, Medicine, Warehouse, Inventory, DeliveryPartner, Order, OrderItem } from '../models/index.js';
import { UserRole, MedicineType, PrescriptionRequirement, Gender, OrderStatus, DeliveryType, UrgencyLevel } from '../types/index.js';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                    JETMED DATABASE SEEDER                        ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  📧 LOGIN CREDENTIALS                                            ║
 * ║  ─────────────────────────────────────────────────               ║
 * ║  👤 Customer    →  customer@jetmed.com    / Password123          ║
 * ║  💊 Pharmacist  →  pharmacist@jetmed.com  / Password123          ║
 * ║  🚚 Delivery    →  delivery@jetmed.com    / Password123          ║
 * ║  📦 Warehouse   →  warehouse@jetmed.com   / Password123          ║
 * ║  👑 Admin       →  admin@jetmed.com       / Admin@123            ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...');
    
    await connectMongoDB();

    await OrderItem.deleteMany({});
    await Order.deleteMany({});
    await Inventory.deleteMany({});
    await Medicine.deleteMany({});
    await Address.deleteMany({});
    await UserProfile.deleteMany({});
    await DeliveryPartner.deleteMany({});
    await Warehouse.deleteMany({});
    await User.deleteMany({});

    console.log('✅ Cleared existing MongoDB collections');
    
    // Pre-hash passwords
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    const userPasswordHash = await bcrypt.hash('Password123', 12);
    
    console.log('✅ Passwords hashed');

    // ============================================
    // 1. ADMIN
    // ============================================
    const admin = await User.create({
      email: 'admin@jetmed.com',
      password: adminPasswordHash,
      role: UserRole.ADMIN_SUPER,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
    });
    
    await UserProfile.create({
      userId: admin.id,
      firstName: 'Super',
      lastName: 'Admin',
      timezone: 'America/New_York',
    });
    console.log('✅ Admin created: admin@jetmed.com / Admin@123');

    // ============================================
    // 2. CUSTOMER
    // ============================================
    const customer = await User.create({
      email: 'customer@jetmed.com',
      phone: '+15550001001',
      password: userPasswordHash,
      role: UserRole.CUSTOMER,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
    });
    
    await UserProfile.create({
      userId: customer.id,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-05-15'),
      gender: Gender.MALE,
      timezone: 'America/New_York',
    });
    
    const customerAddress = await Address.create({
      userId: customer.id,
      label: 'Home',
      streetAddress: '123 Main Street',
      apartment: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.0060,
      isDefault: true,
    });
    console.log('✅ Customer created: customer@jetmed.com / Password123');

    // ============================================
    // 3. PHARMACIST
    // ============================================
    const pharmacist = await User.create({
      email: 'pharmacist@jetmed.com',
      phone: '+15550002001',
      password: userPasswordHash,
      role: UserRole.PHARMACIST,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
    });
    
    await UserProfile.create({
      userId: pharmacist.id,
      firstName: 'Sarah',
      lastName: 'Miller',
      dateOfBirth: new Date('1985-03-10'),
      gender: Gender.FEMALE,
      timezone: 'America/New_York',
    });
    console.log('✅ Pharmacist created: pharmacist@jetmed.com / Password123');

    // ============================================
    // 4. DELIVERY PARTNER
    // ============================================
    const deliveryUser = await User.create({
      email: 'delivery@jetmed.com',
      phone: '+15550003001',
      password: userPasswordHash,
      role: UserRole.DELIVERY_PARTNER,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
    });
    
    await UserProfile.create({
      userId: deliveryUser.id,
      firstName: 'David',
      lastName: 'Wilson',
      dateOfBirth: new Date('1992-07-04'),
      gender: Gender.MALE,
      timezone: 'America/New_York',
    });
    
    await DeliveryPartner.create({
      userId: deliveryUser.id,
      vehicleType: 'motorcycle',
      vehicleNumber: 'NY-1234',
      licenseNumber: 'DL123456789',
      licenseExpiryDate: new Date('2026-12-31'),
      documentsVerified: true,
      isOnline: true,
      currentLatitude: 40.7128,
      currentLongitude: -74.0060,
      totalDeliveries: 150,
      rating: 4.8,
      totalEarnings: 3500,
    });
    console.log('✅ Delivery Partner created: delivery@jetmed.com / Password123');

    // ============================================
    // 5. WAREHOUSE STAFF
    // ============================================
    const warehouseUser = await User.create({
      email: 'warehouse@jetmed.com',
      phone: '+15550004001',
      password: userPasswordHash,
      role: UserRole.WAREHOUSE_STAFF,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
    });
    
    await UserProfile.create({
      userId: warehouseUser.id,
      firstName: 'Mike',
      lastName: 'Johnson',
      dateOfBirth: new Date('1988-09-20'),
      gender: Gender.MALE,
      timezone: 'America/New_York',
    });
    console.log('✅ Warehouse Staff created: warehouse@jetmed.com / Password123');

    // ============================================
    // WAREHOUSES
    // ============================================
    const warehouse1 = await Warehouse.create({
      name: 'JetMed NYC Hub',
      code: 'NYC-001',
      address: '123 Pharmacy Lane',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      latitude: 40.7128,
      longitude: -74.0060,
      deliveryRadius: 25,
      isActive: true,
    });
    
    await Warehouse.create({
      name: 'JetMed LA Hub',
      code: 'LA-001',
      address: '456 Medicine Blvd',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      latitude: 34.0522,
      longitude: -118.2437,
      deliveryRadius: 30,
      isActive: true,
    });
    
    console.log('✅ Warehouses created');
    
    // ============================================
    // MEDICINES (with images from Unsplash)
    // ============================================
    const medicines = [
      { 
        name: 'Tylenol Extra Strength', 
        genericName: 'Acetaminophen', 
        category: 'Pain Relief', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 9.99,
        manufacturer: 'Johnson & Johnson',
        description: 'Tylenol Extra Strength provides fast, effective relief of headaches, minor arthritis and muscle aches, backaches, and toothaches.',
        images: [
          'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Advil', 
        genericName: 'Ibuprofen', 
        category: 'Pain Relief', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 8.99,
        manufacturer: 'Pfizer',
        description: 'Advil provides powerful relief from pain and fever. Trusted by millions for headaches, muscle aches, and minor arthritis pain.',
        images: [
          'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Benadryl', 
        genericName: 'Diphenhydramine', 
        category: 'Allergy', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 7.99,
        manufacturer: 'Johnson & Johnson',
        description: 'Benadryl provides fast, effective relief of allergy symptoms including sneezing, runny nose, itchy eyes, and hives.',
        images: [
          'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Zyrtec', 
        genericName: 'Cetirizine', 
        category: 'Allergy', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 12.99,
        manufacturer: 'Johnson & Johnson',
        description: 'Zyrtec provides powerful 24-hour relief of indoor and outdoor allergy symptoms. Non-drowsy formula.',
        images: [
          'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Amoxicillin', 
        genericName: 'Amoxicillin', 
        category: 'Antibiotics', 
        type: MedicineType.CAPSULE, 
        prescriptionRequirement: PrescriptionRequirement.PRESCRIPTION_REQUIRED, 
        price: 15.99,
        manufacturer: 'Teva Pharmaceuticals',
        description: 'Amoxicillin is a penicillin antibiotic used to treat many different types of bacterial infections.',
        images: [
          'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Metformin', 
        genericName: 'Metformin HCL', 
        category: 'Diabetes', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.PRESCRIPTION_REQUIRED, 
        price: 12.99,
        manufacturer: 'Bristol-Myers Squibb',
        description: 'Metformin is used to control blood sugar levels in people with type 2 diabetes.',
        images: [
          'https://images.unsplash.com/photo-1558956397-7f6aea7aaab9?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1573883431205-98b5f10f0edd?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Lisinopril', 
        genericName: 'Lisinopril', 
        category: 'Heart Health', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.PRESCRIPTION_REQUIRED, 
        price: 14.99,
        manufacturer: 'Merck & Co.',
        description: 'Lisinopril is an ACE inhibitor used to treat high blood pressure and heart failure.',
        images: [
          'https://images.unsplash.com/photo-1626716493137-b67fe9501e76?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Ventolin HFA', 
        genericName: 'Albuterol', 
        category: 'Respiratory', 
        type: MedicineType.INHALER, 
        prescriptionRequirement: PrescriptionRequirement.PRESCRIPTION_REQUIRED, 
        price: 45.99,
        manufacturer: 'GlaxoSmithKline',
        description: 'Ventolin HFA is a bronchodilator that relaxes muscles in the airways and increases air flow to the lungs.',
        images: [
          'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Centrum Adults', 
        genericName: 'Multivitamin', 
        category: 'Vitamins', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 18.99,
        manufacturer: 'Pfizer',
        description: 'Centrum Adults is a complete multivitamin formulated for adults to support energy, immunity, and metabolism.',
        images: [
          'https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1577401132921-cb39bb0adcff?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Omeprazole', 
        genericName: 'Omeprazole', 
        category: 'Digestive Health', 
        type: MedicineType.CAPSULE, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 16.99,
        manufacturer: 'AstraZeneca',
        description: 'Omeprazole is a proton pump inhibitor that treats heartburn, acid reflux, and stomach ulcers.',
        images: [
          'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1580281657702-257584239a55?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'NyQuil Cold & Flu', 
        genericName: 'Acetaminophen/Dextromethorphan/Doxylamine', 
        category: 'Cold & Flu', 
        type: MedicineType.SYRUP, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 11.99,
        manufacturer: 'Procter & Gamble',
        description: 'NyQuil provides nighttime relief of common cold and flu symptoms so you can rest.',
        images: [
          'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Hydrocortisone Cream', 
        genericName: 'Hydrocortisone', 
        category: 'Skin Care', 
        type: MedicineType.CREAM, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 8.49,
        manufacturer: 'Bayer',
        description: 'Hydrocortisone cream provides temporary relief of itching and rashes due to eczema, insect bites, and skin irritations.',
        images: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Claritin', 
        genericName: 'Loratadine', 
        category: 'Allergy', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 14.99,
        manufacturer: 'Bayer',
        description: 'Claritin provides 24-hour non-drowsy relief from allergy symptoms including sneezing, runny nose, and itchy eyes.',
        images: [
          'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Melatonin 5mg', 
        genericName: 'Melatonin', 
        category: 'Sleep Aid', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 9.99,
        manufacturer: 'Nature Made',
        description: 'Melatonin helps regulate your sleep cycle and promotes restful sleep naturally.',
        images: [
          'https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Pepto-Bismol', 
        genericName: 'Bismuth Subsalicylate', 
        category: 'Digestive Health', 
        type: MedicineType.SYRUP, 
        prescriptionRequirement: PrescriptionRequirement.OTC, 
        price: 7.99,
        manufacturer: 'Procter & Gamble',
        description: 'Pepto-Bismol relieves upset stomach, indigestion, nausea, heartburn, and diarrhea.',
        images: [
          'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400&h=400&fit=crop'
        ]
      },
      { 
        name: 'Atorvastatin', 
        genericName: 'Atorvastatin Calcium', 
        category: 'Heart Health', 
        type: MedicineType.TABLET, 
        prescriptionRequirement: PrescriptionRequirement.PRESCRIPTION_REQUIRED, 
        price: 22.99,
        manufacturer: 'Pfizer',
        description: 'Atorvastatin is a statin medication used to lower cholesterol and reduce the risk of heart disease.',
        images: [
          'https://images.unsplash.com/photo-1626716493137-b67fe9501e76?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=400&fit=crop'
        ]
      },
    ];
    
    const createdMedicines: any[] = [];

    const dosageTemplatesByType: Record<string, Array<{ strength: string; unit: string; factor: number }>> = {
      [MedicineType.TABLET]: [
        { strength: '250', unit: 'mg', factor: 0.8 },
        { strength: '500', unit: 'mg', factor: 1 },
      ],
      [MedicineType.CAPSULE]: [
        { strength: '250', unit: 'mg', factor: 0.85 },
        { strength: '500', unit: 'mg', factor: 1.05 },
      ],
      [MedicineType.SYRUP]: [
        { strength: '60', unit: 'ml', factor: 0.9 },
        { strength: '100', unit: 'ml', factor: 1.1 },
      ],
      [MedicineType.CREAM]: [
        { strength: '15', unit: 'g', factor: 0.85 },
        { strength: '30', unit: 'g', factor: 1.15 },
      ],
      [MedicineType.DROPS]: [
        { strength: '10', unit: 'ml', factor: 0.9 },
        { strength: '20', unit: 'ml', factor: 1.2 },
      ],
      [MedicineType.INHALER]: [
        { strength: '120', unit: 'doses', factor: 1 },
      ],
      [MedicineType.INJECTION]: [
        { strength: '1', unit: 'vial', factor: 1 },
      ],
      default: [{ strength: '1', unit: 'unit', factor: 1 }],
    };

    for (const med of medicines) {
      const dosageTemplate = dosageTemplatesByType[med.type] || dosageTemplatesByType.default;
      const dosageOptions = dosageTemplate.map((tpl, idx) => ({
        id: `opt-${idx + 1}`,
        strength: tpl.strength,
        unit: tpl.unit,
        price: Number((med.price * tpl.factor).toFixed(2)),
        sku: `SKU-${med.name.replace(/\s+/g, '-').toUpperCase()}-${idx + 1}`,
      }));

      const medicine = await Medicine.create({
        name: med.name,
        genericName: med.genericName,
        category: med.category,
        type: med.type,
        prescriptionRequirement: med.prescriptionRequirement,
        description: med.description,
        manufacturer: med.manufacturer,
        dosageOptions: dosageOptions as any,
        activeIngredients: [med.genericName, 'Inactive excipients'],
        uses: [
          `Supports ${med.category.toLowerCase()} symptom relief`,
          'Use exactly as directed by label or healthcare professional',
        ],
        sideEffects: [
          'Mild nausea or stomach discomfort may occur',
          'Stop use and consult a doctor if symptoms worsen',
        ],
        warnings: [
          'Keep out of reach of children',
          'Do not exceed recommended dose',
          med.prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED
            ? 'Use only under medical supervision'
            : 'Read package instructions before use',
        ],
        contraindications: [],
        drugInteractions: ['Consult pharmacist for potential interactions'],
        storageInstructions: 'Store at room temperature away from moisture and heat.',
        images: med.images,
        isVegan: med.type !== MedicineType.CAPSULE,
        isSugarFree: med.type !== MedicineType.SYRUP,
        isAlcoholFree: true,
        isPregnancySafe: med.prescriptionRequirement === PrescriptionRequirement.OTC,
        isLactationSafe: med.prescriptionRequirement === PrescriptionRequirement.OTC,
        isGlutenFree: true,
        isActive: true,
      });

      createdMedicines.push(medicine);
      
      // Create inventory with varying quantities
      const quantities = [500, 200, 100, 50, 25];
      const randomQty = quantities[Math.floor(Math.random() * quantities.length)];
      
      await Inventory.create({
        medicineId: medicine.id,
        dosageOptionId: dosageOptions[0].id,
        warehouseId: warehouse1.id,
        quantity: randomQty,
        reservedQuantity: 0,
        reorderLevel: 50,
        reorderQuantity: 200,
        batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        expiryDate: new Date(Date.now() + (Math.random() * 365 + 180) * 24 * 60 * 60 * 1000), // 6-18 months
        costPrice: med.price * 0.6,
      });
    }
    
    console.log(`✅ ${medicines.length} medicines created with images and inventory`);

    const medicineByName = new Map(createdMedicines.map((m) => [m.name, m]));
    const popularityPlan = [
      { name: 'Tylenol Extra Strength', units: [2, 1, 2, 1, 3], status: OrderStatus.DELIVERED },
      { name: 'Advil', units: [1, 1, 2, 1], status: OrderStatus.DELIVERED },
      { name: 'Benadryl', units: [1, 2, 1], status: OrderStatus.DELIVERED },
      { name: 'Zyrtec', units: [1, 1], status: OrderStatus.OUT_FOR_DELIVERY },
      { name: 'Vitamin D3', units: [1, 1], status: OrderStatus.PACKING },
      { name: 'Amoxicillin', units: [1], status: OrderStatus.APPROVED },
    ];

    for (const plan of popularityPlan) {
      const med = medicineByName.get(plan.name);
      if (!med) continue;

      for (const qty of plan.units) {
        const price = Number(med.dosageOptions?.[0]?.price || med.price || 10);
        const subtotal = Number((price * qty).toFixed(2));
        const deliveryFee = 4.99;
        const total = Number((subtotal + deliveryFee).toFixed(2));

        const order = await Order.create({
          orderNumber: Order.generateOrderNumber(),
          userId: customer.id,
          warehouseId: warehouse1.id,
          addressId: customerAddress.id,
          status: plan.status,
          items: [
            {
              medicineId: med.id,
              dosageOptionId: med.dosageOptions?.[0]?.id || 'opt-1',
              quantity: qty,
              unitPrice: price,
              totalPrice: subtotal,
              prescriptionRequired: med.prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED,
            },
          ] as any,
          subtotal,
          deliveryFee,
          platformFee: 0,
          taxAmount: 0,
          discountAmount: 0,
          tipAmount: 0,
          totalAmount: total,
          deliveryType: DeliveryType.STANDARD,
          urgencyLevel: UrgencyLevel.ROUTINE,
          prescriptionRequired: med.prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED,
          prescriptionIds: [],
          reviewedBy: pharmacist.id,
          reviewedAt: new Date(),
          packedBy: warehouseUser.id,
          packedAt: plan.status === OrderStatus.PACKING || plan.status === OrderStatus.OUT_FOR_DELIVERY || plan.status === OrderStatus.DELIVERED ? new Date() : undefined,
          deliveryPartnerId: plan.status === OrderStatus.OUT_FOR_DELIVERY || plan.status === OrderStatus.DELIVERED ? deliveryUser.id : undefined,
          deliveryStartedAt: plan.status === OrderStatus.OUT_FOR_DELIVERY || plan.status === OrderStatus.DELIVERED ? new Date() : undefined,
          deliveredAt: plan.status === OrderStatus.DELIVERED ? new Date() : undefined,
        });

        await OrderItem.create({
          orderId: order.id,
          medicineId: med.id,
          dosageOptionId: med.dosageOptions?.[0]?.id || 'opt-1',
          quantity: qty,
          unitPrice: price,
          totalPrice: subtotal,
          prescriptionRequired: med.prescriptionRequirement === PrescriptionRequirement.PRESCRIPTION_REQUIRED,
        });
      }
    }

    console.log('✅ Demo order history created for popularity ranking');
    
    // ============================================
    // DONE
    // ============================================
    console.log('');
    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('┌──────────────────────────────────────────────────────┐');
    console.log('│              📧 LOGIN CREDENTIALS                    │');
    console.log('├──────────────────────────────────────────────────────┤');
    console.log('│  👤 Customer    →  customer@jetmed.com   / Password123');
    console.log('│  💊 Pharmacist  →  pharmacist@jetmed.com / Password123');
    console.log('│  🚚 Delivery    →  delivery@jetmed.com   / Password123');
    console.log('│  📦 Warehouse   →  warehouse@jetmed.com  / Password123');
    console.log('│  👑 Admin       →  admin@jetmed.com      / Admin@123');
    console.log('└──────────────────────────────────────────────────────┘');
    console.log('');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();