/**
 * Seed script — inserts 40+ records into the Neon production database.
 * Run: node scripts/seed-production.mjs
 */
import pg from "pg";

const { Pool } = pg;

const PROD_URL =
  process.env.PROD_DATABASE_URL ||
  "postgresql://neondb_owner:npg_xqS7vuZK8TOI@ep-dry-snow-ae0fw61l.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Determine SSL settings based on environment (localhost doesn't support SSL)
const isLocalhost = PROD_URL.includes("localhost");
const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

const pool = new Pool({ connectionString: PROD_URL, ssl: sslConfig });

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to Neon production DB");

    // ── CATEGORIES ──────────────────────────────────────────────────
    console.log("Seeding categories...");
    const catResult = await client.query(`
      INSERT INTO categories (name, slug, icon, image) VALUES
        ('Pens & Pencils',   'pens-pencils',   '✏️',  'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400&q=80'),
        ('Notebooks',        'notebooks',       '📓',  'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80'),
        ('Art Supplies',     'art-supplies',    '🎨',  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80'),
        ('Office Supplies',  'office-supplies', '📎',  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80'),
        ('Paper Products',   'paper-products',  '📄',  'https://images.unsplash.com/photo-1568658980814-8d3d4cbf43d5?w=400&q=80'),
        ('Geometry & Math',  'geometry-math',   '📐',  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80'),
        ('School Bags',      'school-bags',     '🎒',  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80'),
        ('Craft Supplies',   'craft-supplies',  '✂️',  'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&q=80')
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, slug
    `);
    console.log(`  → ${catResult.rowCount} categories inserted`);

    // Build slug→id map
    const allCats = await client.query("SELECT id, slug FROM categories");
    const catMap = {};
    for (const row of allCats.rows) catMap[row.slug] = row.id;

    const pensCatId    = catMap["pens-pencils"];
    const notesCatId   = catMap["notebooks"];
    const artCatId     = catMap["art-supplies"];
    const officeCatId  = catMap["office-supplies"];
    const paperCatId   = catMap["paper-products"];
    const geoCatId     = catMap["geometry-math"];
    const bagsCatId    = catMap["school-bags"];
    const craftCatId   = catMap["craft-supplies"];

    // ── PRODUCTS ────────────────────────────────────────────────────
    console.log("Seeding products...");
    const products = [
      // Pens & Pencils
      { name: "Cello Butterflow Ball Pen (Blue, Pack of 10)", desc: "Smooth writing ball pen with comfortable grip. Ideal for everyday use.", cat: pensCatId,  actual: 120, selling: 85,  stock: 200, threshold: 20, tags: ["pen","ballpen","blue","cello"], featured: true,  sales: 320 },
      { name: "Apsara Platinum Extra Dark Pencil (Pack of 10)", desc: "Extra dark graphite pencil for bold, clear writing. Perfect for students.", cat: pensCatId, actual: 60, selling: 45, stock: 350, threshold: 30, tags: ["pencil","apsara","dark","student"], featured: false, sales: 210 },
      { name: "Camlin Fountain Pen (Blue & Gold)", desc: "Classic fountain pen with gold nib, smooth ink flow. Makes writing a pleasure.", cat: pensCatId, actual: 299, selling: 220, stock: 80, threshold: 10, tags: ["fountain","pen","camlin","premium"], featured: true, sales: 95 },
      { name: "Flair Writo-Meter Ball Pen (Black, 5-pack)", desc: "Writes up to 10 km. Ergonomic design with non-slip grip.", cat: pensCatId, actual: 75, selling: 55, stock: 300, threshold: 25, tags: ["pen","ballpen","black","flair"], featured: false, sales: 185 },
      { name: "Staedtler Noris Pencil Set (HB, 12 pcs)", desc: "Worldwide trusted Noris pencil with yellow/black striped design. Break-resistant.", cat: pensCatId, actual: 220, selling: 175, stock: 120, threshold: 15, tags: ["pencil","staedtler","set","hb"], featured: true, sales: 140 },
      { name: "Luxor Micra Ball Pen (Red, Pack of 5)", desc: "Fine tip ball pen ideal for marking, annotations and corrections.", cat: pensCatId, actual: 50, selling: 38, stock: 400, threshold: 40, tags: ["pen","red","luxor","fine"], featured: false, sales: 98 },

      // Notebooks
      { name: "Classmate Pulse Notebook (A4, 200 pages, Single Line)", desc: "Smooth single-line pages, water-resistant cover. Perfect for college students.", cat: notesCatId, actual: 149, selling: 110, stock: 250, threshold: 20, tags: ["notebook","classmate","a4","lined"], featured: true, sales: 420 },
      { name: "Navneet Youva Spiral Notebook (A5, 160 pages)", desc: "Spiral-bound notebook with micro-perforated pages. Easy to tear out neat sheets.", cat: notesCatId, actual: 120, selling: 95, stock: 180, threshold: 15, tags: ["notebook","spiral","navneet","a5"], featured: false, sales: 280 },
      { name: "Paperkraft Premium Hard Cover Diary (A5)", desc: "Premium hardcover diary with ribbon bookmark and elastic closure. 365 pages.", cat: notesCatId, actual: 399, selling: 299, stock: 60, threshold: 8, tags: ["diary","premium","hardcover","paperkraft"], featured: true, sales: 75 },
      { name: "JK Excel Maths Notebook (A4, 5mm Grid)", desc: "High-quality graph paper notebook for mathematical calculations and drawings.", cat: notesCatId, actual: 99, selling: 75, stock: 200, threshold: 20, tags: ["notebook","graph","maths","jk"], featured: false, sales: 155 },
      { name: "Classmate Unruled Notebook (A4, 100 pages)", desc: "Plain unruled pages for creative sketching, diagrams, and free writing.", cat: notesCatId, actual: 80, selling: 65, stock: 220, threshold: 20, tags: ["notebook","unruled","classmate","sketch"], featured: false, sales: 110 },

      // Art Supplies
      { name: "Camlin Kokuyo 12-Shade Water Colour Box", desc: "Vibrant water colours for school projects and artwork. Non-toxic, safe for children.", cat: artCatId, actual: 199, selling: 149, stock: 100, threshold: 12, tags: ["watercolour","camlin","art","kids"], featured: true, sales: 185 },
      { name: "Faber-Castell Classic Colour Pencils (24 shades)", desc: "24 pre-sharpened colour pencils with rich, vibrant pigments. Break-resistant leads.", cat: artCatId, actual: 329, selling: 249, stock: 90, threshold: 10, tags: ["colour pencil","faber-castell","art","24"], featured: true, sales: 220 },
      { name: "Camel Oil Pastel (25 shades)", desc: "Smooth oil pastels for blending and layering. Ideal for mixed media art.", cat: artCatId, actual: 179, selling: 135, stock: 75, threshold: 10, tags: ["oil pastel","camel","art","pastel"], featured: false, sales: 130 },
      { name: "Doms Sketch Pen Set (24 colours)", desc: "Bright, water-based sketch pens with fine and broad tip. Safe for children.", cat: artCatId, actual: 149, selling: 110, stock: 120, threshold: 15, tags: ["sketch pen","doms","colour","set"], featured: false, sales: 165 },
      { name: "Staedtler Mars Plastic Eraser (Pack of 3)", desc: "Professional grade plastic eraser, removes graphite and coloured pencil marks cleanly.", cat: artCatId, actual: 99, selling: 75, stock: 200, threshold: 20, tags: ["eraser","staedtler","art","clean"], featured: false, sales: 88 },
      { name: "Winsor & Newton Sketch Pad (A4, 50 sheets)", desc: "Acid-free cartridge paper ideal for pencil, charcoal and light washes.", cat: artCatId, actual: 299, selling: 240, stock: 40, threshold: 5, tags: ["sketch pad","winsor","a4","acid-free"], featured: true, sales: 55 },

      // Office Supplies
      { name: "Kangaro Stapler (HD-10, with staples)", desc: "Heavy duty stapler with 26/6 staples. Staples up to 20 sheets at once.", cat: officeCatId, actual: 349, selling: 269, stock: 65, threshold: 8, tags: ["stapler","kangaro","office","heavy-duty"], featured: false, sales: 72 },
      { name: "Oddy Transparent Tape (18mm × 66m, Pack of 6)", desc: "Crystal clear adhesive tape, ideal for packaging and office use.", cat: officeCatId, actual: 189, selling: 145, stock: 150, threshold: 15, tags: ["tape","oddy","transparent","pack"], featured: false, sales: 105 },
      { name: "Kores Glue Stick (15g, Pack of 3)", desc: "Non-toxic glue stick with smooth application. Dries clear and repositionable.", cat: officeCatId, actual: 99, selling: 75, stock: 200, threshold: 20, tags: ["glue","kores","stick","office"], featured: false, sales: 190 },
      { name: "Lexi Scissor Set (Small + Large)", desc: "Stainless steel blades with comfortable rubber grip handles. Rust-resistant.", cat: officeCatId, actual: 199, selling: 149, stock: 80, threshold: 10, tags: ["scissor","lexi","office","stainless"], featured: false, sales: 66 },
      { name: "Solo Expanding File (A4, 13 pockets)", desc: "PP material expanding file with A4 capacity and elastic closure. 13 colour-coded pockets.", cat: officeCatId, actual: 249, selling: 189, stock: 55, threshold: 7, tags: ["file","solo","expanding","a4"], featured: false, sales: 48 },
      { name: "Classmate Whiteboard Marker (4-colour pack)", desc: "Water-based whiteboard markers. Easily erasable with a dry cloth.", cat: officeCatId, actual: 129, selling: 99, stock: 130, threshold: 15, tags: ["marker","whiteboard","classmate","4-pack"], featured: true, sales: 145 },

      // Paper Products
      { name: "JK Copier A4 Paper (500 sheets, 75 GSM)", desc: "Premium copier paper with high brightness (102%). Compatible with all printers.", cat: paperCatId, actual: 349, selling: 299, stock: 120, threshold: 15, tags: ["paper","a4","jk","copier"], featured: false, sales: 210 },
      { name: "Camlin Graph Paper Sheets (A4, 100 sheets)", desc: "1mm and 5mm grid graph paper for mathematics and technical drawing.", cat: paperCatId, actual: 149, selling: 110, stock: 90, threshold: 12, tags: ["graph paper","camlin","a4","maths"], featured: false, sales: 95 },
      { name: "Post-it Notes (76×76mm, 6 colours, 480 sheets)", desc: "Repositionable adhesive notes. Available in 6 vibrant colours. Perfect for reminders.", cat: paperCatId, actual: 299, selling: 229, stock: 75, threshold: 10, tags: ["post-it","notes","sticky","colour"], featured: true, sales: 138 },
      { name: "Chart Paper (30×40 cm, Assorted, Pack of 25)", desc: "Bright coloured chart paper for projects, posters and presentations.", cat: paperCatId, actual: 149, selling: 109, stock: 200, threshold: 20, tags: ["chart","paper","colour","project"], featured: false, sales: 175 },

      // Geometry & Math
      { name: "Camlin 9-Piece Geometry Box (Classic)", desc: "Complete geometry set with compass, divider, protractor, set-squares and ruler.", cat: geoCatId, actual: 199, selling: 149, stock: 150, threshold: 15, tags: ["geometry","camlin","set","compass"], featured: true, sales: 295 },
      { name: "Doms Neon Geometry Box (7-piece)", desc: "Neon coloured geometry instruments in a sturdy box. Compass with needle safety cap.", cat: geoCatId, actual: 149, selling: 110, stock: 120, threshold: 12, tags: ["geometry","doms","neon","compass"], featured: false, sales: 180 },
      { name: "Staedtler Ruler Set (15cm + 30cm)", desc: "Precision-marked transparent plastic rulers. Shatter-resistant and flexible.", cat: geoCatId, actual: 89, selling: 65, stock: 250, threshold: 25, tags: ["ruler","staedtler","set","transparent"], featured: false, sales: 115 },
      { name: "Scientific Calculator Casio FX-82MS", desc: "2-line display, 240 functions. Ideal for school and college mathematics.", cat: geoCatId, actual: 699, selling: 549, stock: 45, threshold: 5, tags: ["calculator","casio","scientific","fx-82ms"], featured: true, sales: 68 },

      // School Bags
      { name: "Wildcraft Ace Backpack 30L (Blue)", desc: "Durable polyester backpack with laptop compartment and ergonomic shoulder straps.", cat: bagsCatId, actual: 1499, selling: 1099, stock: 30, threshold: 5, tags: ["bag","wildcraft","backpack","30l"], featured: true, sales: 42 },
      { name: "Skybags Pixel School Bag (22L, Green)", desc: "Lightweight with multiple compartments. Water-resistant fabric, adjustable straps.", cat: bagsCatId, actual: 999, selling: 749, stock: 25, threshold: 4, tags: ["bag","skybags","school","22l"], featured: false, sales: 38 },
      { name: "American Tourister Hatch School Bag", desc: "Premium school bag with reflective strip, padded back, and rain cover included.", cat: bagsCatId, actual: 1799, selling: 1399, stock: 15, threshold: 3, tags: ["bag","american-tourister","premium","school"], featured: true, sales: 28 },

      // Craft Supplies
      { name: "Fevicol MR Synthetic Resin Adhesive (200g)", desc: "India's most trusted wood and craft adhesive. Strong bond, water resistant when dry.", cat: craftCatId, actual: 129, selling: 99, stock: 150, threshold: 15, tags: ["fevicol","glue","craft","adhesive"], featured: false, sales: 240 },
      { name: "Origami Paper Pack (15×15cm, 100 sheets, 10 colours)", desc: "Thin but strong origami paper in 10 vibrant colours. Acid-free and fade-resistant.", cat: craftCatId, actual: 149, selling: 109, stock: 100, threshold: 12, tags: ["origami","paper","craft","colour"], featured: false, sales: 88 },
      { name: "Doms Wax Crayons (48 shades)", desc: "Bright wax crayons that blend easily. Non-toxic, safe for kids aged 3 and above.", cat: craftCatId, actual: 199, selling: 155, stock: 120, threshold: 15, tags: ["crayon","doms","48","wax"], featured: true, sales: 145 },
      { name: "Craft Wire Assorted (Copper, Silver, Gold — 3 rolls)", desc: "Flexible craft wire for jewellery making, sculptures and mixed media projects.", cat: craftCatId, actual: 249, selling: 189, stock: 60, threshold: 8, tags: ["wire","craft","copper","jewellery"], featured: false, sales: 35 },
      { name: "Kores Correction Pen (7ml)", desc: "Fluid correction pen for clean corrections on paper. Quick-dry white formula.", cat: officeCatId, actual: 79, selling: 59, stock: 300, threshold: 30, tags: ["correction","kores","pen","white"], featured: false, sales: 177 },
      { name: "Luxor 4-in-1 Multi-Colour Ball Pen", desc: "Single pen with 4 ink colours: blue, red, green and black. Click-to-switch mechanism.", cat: pensCatId, actual: 99, selling: 75, stock: 180, threshold: 20, tags: ["pen","multi-colour","luxor","4-in-1"], featured: false, sales: 122 },
    ];

    let prodCount = 0;
    for (const p of products) {
      await client.query(
        `INSERT INTO products
          (name, description, category_id, actual_price, selling_price, stock, low_stock_threshold, tags, is_featured, sales_count, images, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         ON CONFLICT DO NOTHING`,
        [
          p.name, p.desc, p.cat,
          p.actual.toFixed(2), p.selling.toFixed(2),
          p.stock, p.threshold,
          `{${p.tags.map(t => `"${t}"`).join(",")}}`,
          p.featured, p.sales,
          `{}`
        ]
      );
      prodCount++;
    }
    console.log(`  → ${prodCount} products inserted`);

    // ── BANNERS ─────────────────────────────────────────────────────
    console.log("Seeding banners...");
    await client.query(`
      INSERT INTO banners (title, subtitle, image_url, link_url, position, size, sort_order, is_active) VALUES
        ('Back to School Sale!',   'Up to 40% off on notebooks and stationery', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80', '/', 'TOP', 'FULL', 1, true),
        ('Art Supplies Mega Deal', 'Faber-Castell, Camlin & more at best prices', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80', '/', 'TOP', 'FULL', 2, true),
        ('Premium Notebooks',      'Hardcover diaries and spiral notebooks now in stock', 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=1200&q=80', '/', 'TOP', 'FULL', 3, true),
        ('Office Must-Haves',      'Staplers, tapes, files and more. Free delivery above ₹500', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80', '/', 'MIDDLE', 'LARGE', 1, true),
        ('Refer & Earn 100 Coins', 'Share your referral code, earn Super Coins instantly!',  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80', '/refer', 'BOTTOM', 'MEDIUM', 1, true)
      ON CONFLICT DO NOTHING
    `);
    console.log("  → 5 banners inserted");

    // ── COUPONS ─────────────────────────────────────────────────────
    console.log("Seeding coupons...");
    await client.query(`
      INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_discount, is_first_order, is_active, usage_limit)
      VALUES
        ('WELCOME50',  'Get ₹50 off on your first order',          'FLAT',       50,  199,  50,  true,  true, 1000),
        ('GUPTA10',    '10% off on all stationery orders',          'PERCENTAGE', 10,  299, 100,  false, true, 500),
        ('SCHOOLBACK', 'Back to school — flat ₹100 off above ₹599', 'FLAT',      100,  599, 100,  false, true, 200),
        ('ARTLOVER',   '15% off on art supplies',                   'PERCENTAGE', 15,  399, 150,  false, true, 300),
        ('FREEBIE25',  'Flat ₹25 off — no minimum',                 'FLAT',       25,    0,  25,  false, true, 100)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log("  → 5 coupons inserted");

    // ── SUMMARY ─────────────────────────────────────────────────────
    const totals = await client.query(
      "SELECT (SELECT count(*) FROM categories) cats, (SELECT count(*) FROM products) prods, (SELECT count(*) FROM banners) banners, (SELECT count(*) FROM coupons) coupons"
    );
    console.log("\n✅ Seed complete! DB now has:");
    console.log(`   Categories : ${totals.rows[0].cats}`);
    console.log(`   Products   : ${totals.rows[0].prods}`);
    console.log(`   Banners    : ${totals.rows[0].banners}`);
    console.log(`   Coupons    : ${totals.rows[0].coupons}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
