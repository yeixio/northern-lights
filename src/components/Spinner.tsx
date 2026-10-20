export default function Spinner({ full = false }: { full?: boolean }) {
  const dot = (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
  );
  return full ? <div className="flex min-h-[60vh] items-center justify-center">{dot}</div> : dot;
}
