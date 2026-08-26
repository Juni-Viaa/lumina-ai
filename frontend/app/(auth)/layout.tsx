export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover"
      style={{ backgroundImage: "url('/images/Background.png')" }}
    >
      <div className="w-full overflow-hidden px-6 py-4 sm:max-w-md sm:rounded-lg">
        {children}
      </div>
    </div>
  );
}