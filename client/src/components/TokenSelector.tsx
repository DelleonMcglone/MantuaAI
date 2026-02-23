import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  ALL_TOKENS,
  POPULAR_TOKENS,
  getTokensByCategory,
  getCategoryDisplayName,
  type Token,
} from "../config/tokens";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";

interface TokenSelectorProps {
  selectedToken?: Token;
  onSelect: (token: Token) => void;
  excludeToken?: Token;
  label?: string;
}

type Category = 'all' | Token['category'];

export function TokenSelector({
  selectedToken,
  onSelect,
  excludeToken,
  label = "Select token",
}: TokenSelectorProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get tokens based on selected category
  const getTokensForCategory = (category: Category) => {
    if (category === 'all') return ALL_TOKENS;
    return getTokensByCategory(category);
  };

  // Filter tokens based on search, category, and exclude
  const filteredTokens = getTokensForCategory(selectedCategory).filter((token) => {
    // Exclude the specified token
    if (excludeToken && token.address.toLowerCase() === excludeToken.address.toLowerCase()) {
      return false;
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Filter popular tokens (exclude the selected exclusion token)
  const availablePopularTokens = POPULAR_TOKENS.filter(
    (token) => !excludeToken || token.address.toLowerCase() !== excludeToken.address.toLowerCase()
  );

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (token: Token) => {
    onSelect(token);
    setOpen(false);
    setSearch("");
    setSelectedCategory('all');
  };

  const categories: Category[] = ['all', 'stablecoin'];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {selectedToken ? (
            <div className="flex items-center gap-2">
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                className="w-5 h-5 rounded-full"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/20';
                }}
              />
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[350px] p-0">
        {/* Search Bar */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Popular Tokens Row */}
        {!search && (
          <div className="p-3 border-b">
            <div className="text-xs font-medium text-muted-foreground mb-2">Popular</div>
            <div className="flex gap-2">
              {availablePopularTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelect(token)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/32';
                    }}
                  />
                  <span className="text-xs font-medium">{token.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        {!search && (
          <div className="p-2 border-b">
            <div className="flex gap-1 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  {category === 'all' ? 'All' : getCategoryDisplayName(category)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="max-h-[300px] overflow-y-auto">
          {filteredTokens.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <DropdownMenuItem
                key={token.address}
                className="p-3 cursor-pointer"
                onSelect={() => handleSelect(token)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-7 h-7 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/28';
                      }}
                    />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {token.symbol}
                        {token.isMock && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Mock
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
