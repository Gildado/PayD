import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  ArrowLeft,
  Book,
  Globe,
  Wallet,
  AlertCircle,
  Shield,
  Rocket,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  documentationCategories,
  searchDocumentation,
  getRelatedItems,
  type DocItem,
  type DocCategory,
} from '../data/documentation';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Globe,
  Wallet,
  AlertCircle,
  Shield,
  Book,
};

function CategoryIcon({ name, className = '' }: { name: string; className?: string }) {
  const IconComponent = iconMap[name] || Book;
  return <IconComponent className={className} />;
}

interface SearchResultItemProps {
  item: DocItem;
  categoryName: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function SearchResultItem({ item, categoryName, isExpanded, onToggle }: SearchResultItemProps) {
  const relatedItems = useMemo(() => getRelatedItems(item), [item]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="border border-white/10 rounded-xl bg-white/5 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex-1">
          <span className="text-xs font-mono text-(--muted) uppercase tracking-wide">
            {categoryName}
          </span>
          <h3 className="font-medium mt-0.5">{item.question}</h3>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-(--muted) transition-transform duration-200 flex-shrink-0 ml-4 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-2 text-sm text-(--muted) leading-relaxed whitespace-pre-line">
              {item.answer}
            </div>
            {relatedItems.length > 0 && (
              <div className="px-5 pb-4 border-t border-white/5 pt-3">
                <span className="text-xs font-mono uppercase tracking-wide text-(--muted)">
                  Related:
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {relatedItems.map((related) => (
                    <Link
                      key={related.id}
                      to={`/help?q=${encodeURIComponent(related.question)}`}
                      className="text-xs px-2 py-1 rounded-md bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20 transition"
                    >
                      {related.question}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HelpCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [search, setSearch] = useState(initialQuery);
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearch(queryParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialQuery) {
      const results = searchDocumentation(initialQuery);
      if (results.length > 0) {
        setOpenItems(new Set([results[0].id]));
      }
    }
  }, [initialQuery]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return searchDocumentation(search);
  }, [search]);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, { category: DocCategory; items: DocItem[] }> = {};
    for (const item of searchResults) {
      const category = documentationCategories.find((c) => c.id === item.category);
      if (category) {
        if (!grouped[category.id]) {
          grouped[category.id] = { category, items: [] };
        }
        grouped[category.id].items.push(item);
      }
    }
    return Object.values(grouped);
  }, [searchResults]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (value) {
      setSearchParams({ q: value });
    } else {
      setSearchParams({});
    }
    setOpenItems(new Set());
  };

  const toggleItem = useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleCategoryItem = useCallback(
    (categoryId: string, itemIdx: number) => {
      const id = `${categoryId}-${itemIdx}`;
      toggleItem(id);
    },
    [toggleItem]
  );

  const clearSearch = useCallback(() => {
    setSearch('');
    setSearchParams({});
    setOpenItems(new Set());
  }, [setSearchParams]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return documentationCategories;
    return groupedResults.map((g) => ({
      ...g.category,
      items: g.items,
    }));
  }, [search, groupedResults]);

  return (
    <div className="flex flex-1 min-h-0">
      <div className="hidden lg:block w-64 flex-shrink-0 border-r border-(--border) bg-(--surface)">
        <div className="sticky top-0 p-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-(--muted) hover:text-(--text) transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <h2 className="text-xs font-mono uppercase tracking-wider text-(--muted) mb-3">
            Categories
          </h2>
          <nav className="space-y-1">
            {documentationCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearch('');
                  setSearchParams({});
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                  activeCategory === cat.id
                    ? 'bg-(--accent)/10 text-(--accent)'
                    : 'text-(--muted) hover:bg-white/5 hover:text-(--text)'
                }`}
              >
                <CategoryIcon name={cat.icon} className="w-4 h-4" />
                <span className="text-sm">{cat.name}</span>
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-4 border-t border-(--border)">
            <h2 className="text-xs font-mono uppercase tracking-wider text-(--muted) mb-3">
              Quick Links
            </h2>
            <div className="space-y-1">
              <Link
                to="/help?q=trustline"
                className="block text-sm text-(--muted) hover:text-(--accent) transition"
              >
                What is a trustline?
              </Link>
              <Link
                to="/help?q=add+employee"
                className="block text-sm text-(--muted) hover:text-(--accent) transition"
              >
                Adding employees
              </Link>
              <Link
                to="/help?q=failed+transaction"
                className="block text-sm text-(--muted) hover:text-(--accent) transition"
              >
                Transaction errors
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl font-extrabold tracking-tight mb-3">
              Help <span className="text-(--accent)">Center</span>
            </h1>
            <p className="text-(--muted) text-sm font-mono uppercase tracking-widest">
              Documentation · FAQs · Troubleshooting
            </p>
          </motion.div>

          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--muted)" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent text-sm transition"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-(--muted) hover:text-(--text) transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {search && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-(--muted)" />
              </div>
              <p className="text-(--muted) mb-2">No results found for "{search}"</p>
              <p className="text-sm text-(--muted)">
                Try different keywords or browse the categories
              </p>
            </motion.div>
          )}

          {search && searchResults.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
              <p className="text-sm text-(--muted)">
                Found <span className="text-(--accent) font-medium">{searchResults.length}</span>{' '}
                result
                {searchResults.length !== 1 ? 's' : ''}
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {search ? (
              <motion.div
                key="search-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {groupedResults.map(({ category, items }) => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon name={category.icon} className="w-4 h-4 text-(--accent)" />
                      <h2 className="text-sm font-bold text-(--accent2) uppercase tracking-wide">
                        {category.name}
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          categoryName={category.name}
                          isExpanded={openItems.has(item.id)}
                          onToggle={() => toggleItem(item.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-10"
              >
                {filteredCategories.map((section, sectionIdx) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIdx * 0.05 }}
                  >
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-(--accent)/10 border border-(--accent)/20 flex items-center justify-center">
                        <CategoryIcon name={section.icon} className="w-4 h-4 text-(--accent)" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-(--accent2)">{section.name}</h2>
                        <p className="text-xs text-(--muted)">{section.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {section.items.map((item, idx) => {
                        const id = `${section.id}-${idx}`;
                        const isOpen = openItems.has(id);

                        return (
                          <motion.div
                            key={id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="border border-white/10 rounded-xl bg-white/5 overflow-hidden"
                          >
                            <button
                              onClick={() => toggleCategoryItem(section.id, idx)}
                              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
                            >
                              <span className="font-medium">{item.question}</span>
                              <ChevronDown
                                className={`w-4 h-4 text-(--muted) transition-transform duration-200 flex-shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>

                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-5 pb-4 pt-2 text-sm text-(--muted) leading-relaxed whitespace-pre-line">
                                    {item.answer}
                                  </div>
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="px-5 pb-4 border-t border-white/5 pt-3">
                                      <div className="flex flex-wrap gap-2">
                                        {item.tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className="text-xs px-2 py-1 rounded-md bg-white/5 text-(--muted)"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!search && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 p-6 rounded-xl bg-gradient-to-br from-(--accent)/5 to-(--accent2)/5 border border-(--accent)/20"
            >
              <h3 className="font-bold mb-2">Need more help?</h3>
              <p className="text-sm text-(--muted) mb-4">
                If you couldn't find what you were looking for, reach out to our support team.
              </p>
              <a
                href="https://github.com/Gildado/PayD/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--accent) text-black font-medium text-sm hover:opacity-90 transition"
              >
                Open an Issue on GitHub
              </a>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
