import "dotenv/config";
import { db, pool } from "./infrastructure/database/client.js";
import { products } from "./infrastructure/database/schema.js";

async function seed() {
    await db.insert(products).values([
        {
            title: "Vintage Denim Jacket",
            description: "Classic blue denim jacket in excellent condition.",
            price: 1299,
            stock: 3,
        },
        {
            title: "Black Evening Dress",
            description: "Elegant black dress, available for purchase or rental soon.",
            price: 1899,
            stock: 2,
        },
        {
            title: "White Sneakers",
            description: "Minimal white sneakers, lightly used.",
            price: 999,
            stock: 5,
        },
    ]);

    console.log("Products seeded successfully");
}

seed()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });