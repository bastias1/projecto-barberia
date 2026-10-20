import Link from 'next/link'

export default async function BookingConfirmed({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <svg 
              className="w-10 h-10 text-green-600 dark:text-green-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">
          ¡Reserva Confirmada!
        </h1>
        
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Tu asistencia ha sido confirmada exitosamente. Te esperamos en la fecha y hora agendada.
        </p>
        
        <div className="space-y-3">
          <Link 
            href={`/${slug}`}
            className="block w-full bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors font-medium"
          >
            Volver al inicio
          </Link>
          
          <Link 
            href={`/${slug}/agendar`}
            className="block w-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-6 py-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
          >
            Agendar otra cita
          </Link>
        </div>
      </div>
    </div>
  )
}
