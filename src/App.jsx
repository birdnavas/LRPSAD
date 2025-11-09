import React, { useState, useMemo } from "react";
import leadData from "./data/lead.json";
import rpsadData from "./data/rpsad.json";
import rreeppData from "./data/rreepp.json";
import "./App.css";

const sources = [
  { name: leadData.acronym, data: leadData },
  { name: rpsadData.acronym, data: rpsadData },
  { name: rreeppData.acronym, data: rreeppData }
];

function App() {
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [pinnedArticles, setPinnedArticles] = useState([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [query, setQuery] = useState("");

  const normalizeString = (str) =>
    str
      ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : "";

  const toggleSource = (name) => {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const allArticles = useMemo(() => {
    const merged = sources
      .filter((src) => selectedSources.includes(src.name))
      .flatMap((src) =>
        src.data.chapters.flatMap((chapter) =>
          chapter.topics.flatMap((topic) =>
            topic.articles.map((article) => ({
              ...article,
              chapterTitle: chapter.chapterTitle,
              topicTitle: topic.topicTitle,
              sourceName: src.name,
              uniqueId: `${src.name}-${article.articleNumber}`,
            }))
          )
        )
      );

    return merged.sort((a, b) => {
      const numA = Number(a.articleNumber);
      const numB = Number(b.articleNumber);
      if (numA !== numB) return numA - numB;
      return a.sourceName.localeCompare(b.sourceName);
    });
  }, [selectedSources]);

  const toggleArticle = (articleNumber) => {
    setSelectedArticles((prev) =>
      prev.includes(articleNumber)
        ? prev.filter((n) => n !== articleNumber)
        : [...prev, articleNumber]
    );
  };

  const highlight = (text, query) => {
    if (!query || !text) return text;
    const normalizedText = normalizeString(text);
    const normalizedQuery = normalizeString(query);
    const parts = [];
    let lastIndex = 0;
    let matchIndex = normalizedText.indexOf(normalizedQuery);

    while (matchIndex !== -1) {
      parts.push(text.slice(lastIndex, matchIndex));
      parts.push(
        <mark key={matchIndex} className="highlight">
          {text.slice(matchIndex, matchIndex + query.length)}
        </mark>
      );
      lastIndex = matchIndex + query.length;
      matchIndex = normalizedText.indexOf(normalizedQuery, lastIndex);
    }

    parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  };

  const matchesQuery = (article, query) => {
    if (!query) return true;
    const normalizedQuery = normalizeString(query);
    const fields = [];
    if (article.articleTitle) fields.push(article.articleTitle);
    for (let key in article) {
      if (key.startsWith("text") && article[key]) fields.push(article[key]);
    }
    if (article.literals) {
      article.literals.forEach((lit) => {
        fields.push(lit.text);
        lit.numerals?.forEach((num) => {
          fields.push(num.text);
          if (num.text2) fields.push(num.text2);
        });
      });
    }
    return fields.some((f) => normalizeString(f).includes(normalizedQuery));
  };

  const filtered = useMemo(() => {
    let result = allArticles.filter(
      (article) =>
        matchesQuery(article, query) &&
        (selectedArticles.length === 0 || selectedArticles.includes(article.articleNumber))
    );
    if (showPinnedOnly) {
      result = result.filter((a) => pinnedArticles.includes(a.uniqueId));
    }
    return result;
  }, [allArticles, query, selectedArticles, pinnedArticles, showPinnedOnly]);

  const articleNumbers = Array.from(new Set(allArticles.map((a) => a.articleNumber)));

  const handleCopy = (article) => {
    let text = `${article.articleTitle}\n${article.sourceName} → ${article.chapterTitle} → ${article.topicTitle}\n\n`;
    Object.entries(article).forEach(([key, value]) => {
      if (key.startsWith("text") && value) text += `${value}\n`;
      if (key === "literals" && Array.isArray(value)) {
        value.forEach((lit) => {
          text += `${lit.literalLetter}) ${lit.text}\n`;
          lit.numerals?.forEach((num) => {
            text += `   ${num.numeralNumber}. ${num.text}\n`;
            if (num.text2) text += `      ${num.text2}\n`;
          });
        });
      }
    });
    navigator.clipboard.writeText(text.trim());
    setCopiedId(article.uniqueId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePin = (articleId) => {
    setPinnedArticles((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  const toggleExpand = (articleId) => {
    setExpandedIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  return (
    <div className="container">
      {/* Source toggles */}
      <div className="tag-container">
        {sources.map((source) => {
          const isSelected = selectedSources.includes(source.name);
          return (
            <button
              key={source.name}
              className={`tag-button ${isSelected ? "selected" : ""}`}
              onClick={() => toggleSource(source.name)}
            >
              {source.name}
            </button>
          );
        })}
        <button
          onClick={() => setShowPinnedOnly((p) => !p)}
          className={`tag-button ${showPinnedOnly ? "selected" : ""}`}
        >
          📍
        </button>
      </div>

      {/* Article number toggles */}
      <div className="tag-container">
        {articleNumbers.map((num) => (
          <button
            key={num}
            className={`tag-button ${selectedArticles.includes(num) ? "article-selected" : ""}`}
            onClick={() => toggleArticle(num)}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Search input */}
      <input
        type="text"
        placeholder="Buscar..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input"
      />

      {query && <p className="results-count">{filtered.length} Artículo{filtered.length !== 1 && "s"}</p>}

      {/* Results */}
      <div>
        {filtered.map((article) => {
          const isExpanded = expandedIds.includes(article.uniqueId);
          return (
            <div key={article.uniqueId} className="card">
              <div className="card-header" onClick={() => toggleExpand(article.uniqueId)}>
                <div style={{ flex: 1 }}>
                  {highlight(article.articleTitle, query)}
                  <p className="path">
                    {article.sourceName}
                    {article.chapterTitle?.trim() && <> → {article.chapterTitle}</>}
                    {article.topicTitle && <> → {article.topicTitle}</>}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "5px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(article); }}
                    className={`copy-button ${copiedId === article.uniqueId ? "copied" : ""}`}
                  >
                    {copiedId === article.uniqueId ? "📄" : "📋"}
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(article.uniqueId); }}
                    className={`pin-button ${pinnedArticles.includes(article.uniqueId) ? "pin-active" : ""}`}
                  >
                    📍
                  </button>
                </div>
              </div>

              <div className={`expandable ${isExpanded ? "expanded" : ""}`}>
                {Object.entries(article).map(([key, value]) => {
                  if (!value) return null;

                  if (key.startsWith("text")) {
                    return <p key={key}>{highlight(value, query)}</p>;
                  }

                  if (key === "literals") {
                    return (
                      <ul key={key} className="literals-container">
                        {value.map((lit) => (
                          <li key={lit.literalLetter} className="literal-block">
                            <div className="indicator-row">
                              <span className="indicator">{lit.literalLetter})</span>
                              <span className="indicator-text">{highlight(lit.text, query)}</span>
                            </div>
                            {lit.numerals && (
                              <ul className="numeral-container">
                                {lit.numerals.map((num) => (
                                  <li key={num.numeralNumber} className="numeral-item">
                                    <div className="indicator-row">
                                      <span className="indicator">{num.numeralNumber}.</span>
                                      <span className="indicator-text">{highlight(num.text, query)}</span>
                                    </div>
                                    {num.text2 && (
                                      <div className="numeral-text2">{highlight(num.text2, query)}</div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          );
        })}

        {!filtered.length && query && <p className="no-results">Sin resultados.</p>}
      </div>
    </div>
  );
}

export default App;
