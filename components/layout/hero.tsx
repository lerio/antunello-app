export default function Header() {
  return (
    <div className="flex flex-col gap-16 items-center">
      <h1 className="sr-only">Antunello</h1>
      <p className="font-bold text-3xl lg:text-4xl leading-tight! mx-auto max-w-xl text-center">
        Antunello{" "}
      </p>
      <p className="text-3xl lg:text-4xl leading-tight! mx-auto max-w-xl text-center">
        ...dei conti se ne occupa lui{" "}
      </p>
      <div className="w-full p-[1px] bg-linear-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
