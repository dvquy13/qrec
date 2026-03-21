import React from 'react';
import './SearchBar.css';

export interface SearchBarProps {
  query?: string;
  placeholder?: string;
  onSearch?: () => void;
  onClearSearch?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query = '',
  placeholder = 'Search sessions…',
  onSearch,
  onClearSearch,
}) => (
  <div className="search-bar">
    <input
      className="search-bar-input"
      type="text"
      value={query}
      placeholder={placeholder}
      readOnly
    />
    <button className="search-bar-btn" onClick={onSearch}>
      Search
    </button>
    {onClearSearch && query && (
      <button className="search-bar-clear" onClick={onClearSearch}>
        ✕
      </button>
    )}
  </div>
);
