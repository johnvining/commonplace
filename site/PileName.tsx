// Piles named "Prefix: Value" (Status: To read, Location: Kindle, …) act
// as key–value labels. Shows the prefix as a small key before the value.
export function splitPileName(name: string = ''): { pre: string; value: string } {
  const i = name.indexOf(':')
  // A short leading word only, so a title that happens to contain a colon
  // isn't split.
  if (i > 0 && i <= 20 && !name.slice(0, i).includes(' ')) {
    return { pre: name.slice(0, i).trim(), value: name.slice(i + 1).trim() }
  }
  return { pre: '', value: name }
}

export default function PileName({ name }: { name?: string }) {
  const { pre, value } = splitPileName(name)
  if (!pre) return <>{value}</>
  return (
    <>
      <span className="pile-pre">{pre}</span>
      <span className="pile-value">{value}</span>
    </>
  )
}
