export default function HomePage() {
  return (
    <div className="container max-w-4xl py-6 lg:py-10 px-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Home Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Your personalized dashboard is coming soon!
          </p>
        </div>
        
        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        <div className="grid gap-6">
          <p className="text-sm text-gray-500 italic">
            Stay tuned for exciting new features and insights here.
          </p>
        </div>
      </div>
    </div>
  );
}
