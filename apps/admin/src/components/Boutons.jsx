export function BoutonDiscret({ children, ...props }) {
  return (
    <button
      {...props}
      className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-white"
    >
      {children}
    </button>
  )
}

export function BoutonPrincipal({ children, ...props }) {
  return (
    <button
      {...props}
      className="text-sm px-3.5 py-2 rounded-md bg-institution-600 text-white font-medium shadow-sm hover:bg-institution-700 active:bg-institution-700 transition-colors disabled:opacity-50 disabled:hover:bg-institution-600"
    >
      {children}
    </button>
  )
}
