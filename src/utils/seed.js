require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Outlet ──────────────────────────────────────────────────────────────────
  const outlet = await prisma.outlet.upsert({
    where: { id: "outlet-1" },
    update: {},
    create: {
      id: "outlet-1",
      name: "The Grand Kitchen",
      address: "123 MG Road, Bengaluru, Karnataka 560001",
      phone: "9876543210",
      gstNumber: "29AABCT1332L1ZT",
    },
  });
  console.log("✅ Outlet created:", outlet.name);

  // ── Users ────────────────────────────────────────────────────────────────────
  const users = [
    { id: "user-admin", name: "Admin User",   email: "admin@pos.com",   role: "ADMIN",        password: "admin123" },
    { id: "user-mgr",   name: "Ravi Manager", email: "manager@pos.com", role: "MANAGER",      password: "manager123" },
    { id: "user-cash",  name: "Priya Cashier",email: "cashier@pos.com", role: "CASHIER",      password: "cashier123" },
    { id: "user-wait",  name: "Amit Waiter",  email: "waiter@pos.com",  role: "WAITER",       password: "waiter123" },
    { id: "user-kitch", name: "Chef Kumar",   email: "kitchen@pos.com", role: "KITCHEN_STAFF",password: "kitchen123" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { id: u.id, name: u.name, email: u.email, passwordHash, role: u.role, outletId: outlet.id },
    });
  }
  console.log("✅ Users created (5)");

  // ── Categories ───────────────────────────────────────────────────────────────
  const categories = [
    { id: "cat-starters",  name: "Starters",        slug: "starters",        sortOrder: 1 },
    { id: "cat-mains",     name: "Main Course",      slug: "main-course",     sortOrder: 2 },
    { id: "cat-breads",    name: "Breads",           slug: "breads",          sortOrder: 3 },
    { id: "cat-rice",      name: "Rice & Biryani",   slug: "rice-biryani",    sortOrder: 4 },
    { id: "cat-desserts",  name: "Desserts",         slug: "desserts",        sortOrder: 5 },
    { id: "cat-drinks",    name: "Beverages",        slug: "beverages",       sortOrder: 6 },
    { id: "cat-chinese",   name: "Chinese",          slug: "chinese",         sortOrder: 7 },
    { id: "cat-fast-food", name: "Fast Food",        slug: "fast-food",       sortOrder: 8 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  console.log("✅ Categories created (8)");

  // ── Menu Items ───────────────────────────────────────────────────────────────
  const menuItems = [
    // Starters
    { id: "item-1",  name: "Paneer Tikka",         price: 220, categoryId: "cat-starters",  isVeg: true,  gstRate: 5 },
    { id: "item-2",  name: "Chicken Tikka",         price: 280, categoryId: "cat-starters",  isVeg: false, gstRate: 5 },
    { id: "item-3",  name: "Veg Spring Rolls",      price: 160, categoryId: "cat-starters",  isVeg: true,  gstRate: 5 },
    { id: "item-4",  name: "Crispy Corn",           price: 180, categoryId: "cat-starters",  isVeg: true,  gstRate: 5 },
    { id: "item-5",  name: "Fish Fry",              price: 320, categoryId: "cat-starters",  isVeg: false, gstRate: 5 },
    // Main Course
    { id: "item-6",  name: "Paneer Butter Masala",  price: 260, categoryId: "cat-mains",     isVeg: true,  gstRate: 5 },
    { id: "item-7",  name: "Dal Makhani",           price: 200, categoryId: "cat-mains",     isVeg: true,  gstRate: 5 },
    { id: "item-8",  name: "Chicken Curry",         price: 300, categoryId: "cat-mains",     isVeg: false, gstRate: 5 },
    { id: "item-9",  name: "Mutton Rogan Josh",     price: 380, categoryId: "cat-mains",     isVeg: false, gstRate: 5 },
    { id: "item-10", name: "Palak Paneer",          price: 240, categoryId: "cat-mains",     isVeg: true,  gstRate: 5 },
    // Breads
    { id: "item-11", name: "Butter Naan",           price:  50, categoryId: "cat-breads",    isVeg: true,  gstRate: 5 },
    { id: "item-12", name: "Tandoori Roti",         price:  40, categoryId: "cat-breads",    isVeg: true,  gstRate: 5 },
    { id: "item-13", name: "Paratha",               price:  60, categoryId: "cat-breads",    isVeg: true,  gstRate: 5 },
    // Rice & Biryani
    { id: "item-14", name: "Veg Biryani",           price: 220, categoryId: "cat-rice",      isVeg: true,  gstRate: 5 },
    { id: "item-15", name: "Chicken Biryani",       price: 300, categoryId: "cat-rice",      isVeg: false, gstRate: 5 },
    { id: "item-16", name: "Mutton Biryani",        price: 380, categoryId: "cat-rice",      isVeg: false, gstRate: 5 },
    { id: "item-17", name: "Steamed Rice",          price:  80, categoryId: "cat-rice",      isVeg: true,  gstRate: 5 },
    // Desserts
    { id: "item-18", name: "Gulab Jamun",           price:  80, categoryId: "cat-desserts",  isVeg: true,  gstRate: 5 },
    { id: "item-19", name: "Ice Cream",             price: 120, categoryId: "cat-desserts",  isVeg: true,  gstRate: 5 },
    { id: "item-20", name: "Rasgulla",              price:  90, categoryId: "cat-desserts",  isVeg: true,  gstRate: 5 },
    // Beverages
    { id: "item-21", name: "Masala Chai",           price:  40, categoryId: "cat-drinks",    isVeg: true,  gstRate: 5 },
    { id: "item-22", name: "Cold Coffee",           price: 120, categoryId: "cat-drinks",    isVeg: true,  gstRate: 5 },
    { id: "item-23", name: "Fresh Lime Soda",       price:  80, categoryId: "cat-drinks",    isVeg: true,  gstRate: 5 },
    { id: "item-24", name: "Mango Lassi",           price: 100, categoryId: "cat-drinks",    isVeg: true,  gstRate: 5 },
    // Chinese
    { id: "item-25", name: "Veg Fried Rice",        price: 180, categoryId: "cat-chinese",   isVeg: true,  gstRate: 5 },
    { id: "item-26", name: "Chicken Noodles",       price: 220, categoryId: "cat-chinese",   isVeg: false, gstRate: 5 },
    { id: "item-27", name: "Manchurian",            price: 200, categoryId: "cat-chinese",   isVeg: true,  gstRate: 5 },
    // Fast Food
    { id: "item-28", name: "Veg Burger",            price: 120, categoryId: "cat-fast-food", isVeg: true,  gstRate: 5 },
    { id: "item-29", name: "Chicken Burger",        price: 160, categoryId: "cat-fast-food", isVeg: false, gstRate: 5 },
    { id: "item-30", name: "French Fries",          price: 100, categoryId: "cat-fast-food", isVeg: true,  gstRate: 5 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, description: `Freshly prepared ${item.name}` },
    });
  }
  console.log("✅ Menu items created (30)");

  // Add variants to Chicken Biryani
  await prisma.variant.deleteMany({ where: { menuItemId: "item-15" } });
  await prisma.variant.createMany({
    data: [
      { menuItemId: "item-15", name: "Half",  type: "size", priceAdj: -80,  isDefault: false },
      { menuItemId: "item-15", name: "Full",  type: "size", priceAdj: 0,    isDefault: true  },
      { menuItemId: "item-15", name: "Mild",  type: "spice",priceAdj: 0,    isDefault: true  },
      { menuItemId: "item-15", name: "Spicy", type: "spice",priceAdj: 0,    isDefault: false },
    ],
  });

  // Add-ons for burgers
  await prisma.addon.deleteMany({ where: { menuItemId: "item-28" } });
  await prisma.addon.createMany({
    data: [
      { menuItemId: "item-28", name: "Extra Cheese", price: 30 },
      { menuItemId: "item-28", name: "Extra Patty",  price: 50 },
    ],
  });
  console.log("✅ Variants & add-ons created");

  // ── Tables ────────────────────────────────────────────────────────────────────
  const tables = [
    { id:"tbl-1",  number:1,  name:"T1",  capacity:2, section:"Indoor",  posX:100, posY:100 },
    { id:"tbl-2",  number:2,  name:"T2",  capacity:2, section:"Indoor",  posX:220, posY:100 },
    { id:"tbl-3",  number:3,  name:"T3",  capacity:4, section:"Indoor",  posX:340, posY:100 },
    { id:"tbl-4",  number:4,  name:"T4",  capacity:4, section:"Indoor",  posX:460, posY:100 },
    { id:"tbl-5",  number:5,  name:"T5",  capacity:6, section:"Indoor",  posX:100, posY:230 },
    { id:"tbl-6",  number:6,  name:"T6",  capacity:6, section:"Indoor",  posX:280, posY:230 },
    { id:"tbl-7",  number:7,  name:"T7",  capacity:4, section:"Outdoor", posX:100, posY:100 },
    { id:"tbl-8",  number:8,  name:"T8",  capacity:4, section:"Outdoor", posX:250, posY:100 },
    { id:"tbl-9",  number:9,  name:"VIP1",capacity:8, section:"VIP",     posX:100, posY:100 },
    { id:"tbl-10", number:10, name:"VIP2",capacity:8, section:"VIP",     posX:320, posY:100 },
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, outletId: outlet.id },
    });
  }
  console.log("✅ Tables created (10)");

  // ── Suppliers ─────────────────────────────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { id: "sup-1" },
    update: {},
    create: {
      id: "sup-1",
      name: "Fresh Farm Supplies",
      phone: "9898989898",
      email: "fresh@farm.com",
      address: "APMC Market, Bengaluru",
      gstNumber: "29AABCS1234L1ZT",
    },
  });
  console.log("✅ Supplier created");

  // ── Inventory ─────────────────────────────────────────────────────────────────
  const inventoryItems = [
    { id:"inv-1",  name:"Chicken",       unit:"kg",    currentStock:25,  minStock:5,  costPerUnit:180 },
    { id:"inv-2",  name:"Mutton",        unit:"kg",    currentStock:10,  minStock:3,  costPerUnit:550 },
    { id:"inv-3",  name:"Paneer",        unit:"kg",    currentStock:8,   minStock:2,  costPerUnit:280 },
    { id:"inv-4",  name:"Basmati Rice",  unit:"kg",    currentStock:50,  minStock:10, costPerUnit:90  },
    { id:"inv-5",  name:"Cooking Oil",   unit:"litre", currentStock:15,  minStock:5,  costPerUnit:130 },
    { id:"inv-6",  name:"Tomatoes",      unit:"kg",    currentStock:12,  minStock:3,  costPerUnit:30  },
    { id:"inv-7",  name:"Onions",        unit:"kg",    currentStock:20,  minStock:5,  costPerUnit:25  },
    { id:"inv-8",  name:"Flour (Maida)", unit:"kg",    currentStock:30,  minStock:10, costPerUnit:40  },
    { id:"inv-9",  name:"Milk",          unit:"litre", currentStock:10,  minStock:5,  costPerUnit:55  },
    { id:"inv-10", name:"Butter",        unit:"kg",    currentStock:3,   minStock:1,  costPerUnit:480 },
  ];

  for (const inv of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { id: inv.id },
      update: {},
      create: { ...inv, supplierId: supplier.id, outletId: outlet.id },
    });
  }
  console.log("✅ Inventory items created (10)");

  // ── Customers ─────────────────────────────────────────────────────────────────
  const customers = [
    { id:"cust-1", name:"Rahul Sharma",  phone:"9111111111", email:"rahul@email.com",  loyaltyPoints:150, totalSpend:1500, visitCount:5 },
    { id:"cust-2", name:"Priya Patel",   phone:"9222222222", email:"priya@email.com",  loyaltyPoints:320, totalSpend:3200, visitCount:12},
    { id:"cust-3", name:"Arjun Singh",   phone:"9333333333", email:"arjun@email.com",  loyaltyPoints:80,  totalSpend:800,  visitCount:3 },
    { id:"cust-4", name:"Neha Gupta",    phone:"9444444444", email:"neha@email.com",   loyaltyPoints:540, totalSpend:5400, visitCount:20},
    { id:"cust-5", name:"Vikram Reddy",  phone:"9555555555", email:"vikram@email.com", loyaltyPoints:200, totalSpend:2000, visitCount:8 },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({ where: { phone: c.phone }, update: {}, create: c });
  }
  console.log("✅ Customers created (5)");

  // ── Coupons ───────────────────────────────────────────────────────────────────
  const now = new Date();
  const future = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  await prisma.coupon.upsert({
    where: { code: "WELCOME20" },
    update: {},
    create: { code:"WELCOME20", type:"PERCENT", value:20, minOrder:200, maxUses:100, validFrom:now, validUntil:future },
  });
  await prisma.coupon.upsert({
    where: { code: "FLAT50" },
    update: {},
    create: { code:"FLAT50", type:"FLAT", value:50, minOrder:300, maxUses:50, validFrom:now, validUntil:future },
  });
  console.log("✅ Coupons created (2)");

  console.log("\n🎉 Seed complete!\n");
  console.log("Login credentials:");
  console.log("  Admin:   admin@pos.com    / admin123");
  console.log("  Manager: manager@pos.com  / manager123");
  console.log("  Cashier: cashier@pos.com  / cashier123");
  console.log("  Waiter:  waiter@pos.com   / waiter123");
  console.log("  Kitchen: kitchen@pos.com  / kitchen123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
