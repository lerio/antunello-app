import { redirect } from "next/navigation";

type FilterPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** The filter view is now the search page with its filter panel open. */
export default async function FilterPage({ searchParams }: FilterPageProps) {
  const params = await searchParams;
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      next.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => next.append(key, entry));
    }
  }

  next.set("filters", "1");
  redirect(`/protected/search?${next.toString()}`);
}
