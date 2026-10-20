const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)$/i.test(url);

export default function MediaGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  const cols = urls.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`grid ${cols} gap-1 overflow-hidden rounded-lg`}>
      {urls.map((url) =>
        isVideo(url) ? (
          <video key={url} src={url} controls className="max-h-[32rem] w-full bg-black object-contain" />
        ) : (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt="" loading="lazy" className="max-h-[32rem] w-full object-cover" />
          </a>
        ),
      )}
    </div>
  );
}
