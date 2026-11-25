type Product = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  stock: number;
};

type ProductsResponse = {
  success: boolean;
  data: Product[];
};

async function getProducts(): Promise<Product[]> {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const response = await fetch(`${apiUrl}/api/products`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch products");
  }

  const result: ProductsResponse = await response.json();
  return result.data;
}

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ReWear
          </p>

          <h1 className="mt-3 text-4xl font-bold text-gray-900">
            Give clothes a second life.
          </h1>

          <p className="mt-3 text-gray-600">
            Discover pre-loved fashion from the community.
          </p>
        </header>

        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">
            Latest listings
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="rounded-xl border bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                  Product image
                </div>

                <h3 className="font-semibold text-gray-900">
                  {product.title}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {product.description}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </span>

                  <span className="text-sm text-gray-500">
                    {product.stock} available
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}