export function PlaceholderPage({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="placeholder-page">
      <div className="ic">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}
