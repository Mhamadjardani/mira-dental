import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start px-5 py-32">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-4xl font-extrabold">Page not found</h1>
      <Link href="/" className="mt-6 rounded-full bg-brand px-5 py-2.5 font-semibold text-white">
        Home
      </Link>
    </section>
  );
}
