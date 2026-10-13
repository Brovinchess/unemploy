// What the headhunter does and what it runs on, in three lines. Shown where it's deployed.
export function CognitionNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-white/55 ${className}`}>
      Your headhunter searches only when you ask, checks every job on the employer&rsquo;s own site, and writes the application for you.
      It runs on <span className="text-white">cognition</span>, Hello Minds&rsquo; credit, which you can top up any time. Between searches it&rsquo;s
      switched off.
    </p>
  );
}
