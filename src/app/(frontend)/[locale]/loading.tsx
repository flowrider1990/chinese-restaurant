/** Shown while a page's content loads: a quiet skeleton, no spinner. */
export default function Loading() {
  return (
    <div className="loading" aria-busy="true">
      <div className="loading__bar loading__bar--title" />
      <div className="loading__bar" />
      <div className="loading__bar loading__bar--short" />
    </div>
  )
}
