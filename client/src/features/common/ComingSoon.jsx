function ComingSoon({ title }) {
  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{title} — בקרוב</h2>
          <p className="subtitle">העמוד הזה בבנייה. בינתיים, המשך להשתמש במשימות שכבר קיימות.</p>
        </div>
      </section>
    </div>
  );
}

export default ComingSoon;
