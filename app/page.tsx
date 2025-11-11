import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-5xl font-extrabold text-zinc-900 dark:text-zinc-100 sm:text-6xl">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Projecto Barbería
          </span>
        </h1>
        <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-300">
          Test
        </p>
        <div>
            <Link href="/agendar">
              <Button>Agendar</Button>
            </Link>
        </div>
      </main>
    </div>
  );
}
