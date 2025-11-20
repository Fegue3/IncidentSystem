import "./AboutPage.css";

export function AboutPage() {
  return (
    <section className="about">
      <header className="about__header">
        <p className="about__eyebrow">Sobre a aplicação</p>
        <h1 className="about__title">Incident Management System</h1>
        <p className="about__subtitle">
          Uma interface para acompanhar o ciclo de vida de incidentes — desde o
          registo inicial até à resolução e análise posterior.
        </p>
      </header>

      <div className="about__grid">
        <article className="about-card">
          <h2 className="about-card__title">Objetivo</h2>
          <p className="about-card__text">
            Centralizar a gestão de incidentes críticos de forma simples,
            permitindo às equipas priorizar problemas, acompanhar a sua evolução
            e registar decisões.
          </p>
        </article>

        <article className="about-card">
          <h2 className="about-card__title">Principais funcionalidades</h2>
          <ul className="about-card__list">
            <li>Registo e edição de incidentes</li>
            <li>Estados: Open, Investigating, Resolved</li>
            <li>Timeline das ações tomadas</li>
            <li>Dados do responsável e equipa envolvida</li>
          </ul>
        </article>

        <article className="about-card">
          <h2 className="about-card__title">Projeto académico</h2>
          <p className="about-card__text">
            Este sistema foi desenhado no contexto da unidade curricular de
            Engenharia de Software, com foco em modelação, arquitetura e UX.
          </p>
        </article>
      </div>
    </section>
  );
}
