import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch, FiCheck } from 'react-icons/fi';
import {
  PremiumSelectWrapper,
  PremiumSelectTrigger,
  PremiumSelectValue,
  PremiumSelectIcon,
  PremiumSelectDropdown,
  PremiumSelectSearchContainer,
  PremiumSelectSearchInput,
  PremiumSelectOptionsList,
  PremiumSelectOption,
  PremiumSelectOptionIcon,
  PremiumSelectOptionText,
  PremiumSelectOptionLabel,
  PremiumSelectOptionDescription,
  PremiumSelectNoResults,
  PremiumSelectBadge,
  PremiumSelectOverlay
} from './StyledComponents';

function PremiumSelect({
  options = [],
  value = null,
  onChange = () => { },
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  searchable = true,
  disabled = false,
  width,
  mt,
  mb,
  ml,
  mr,
  renderOption = null,
  renderValue = null,
  filterFunction = null,
  noResultsText = "No options found",
  className = "",
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectRef = useRef(null);
  const searchInputRef = useRef(null);

  // Default filter function
  const defaultFilterFunction = (option, searchTerm) => {
    const term = searchTerm.toLowerCase();
    return (
      option.label?.toLowerCase().includes(term) ||
      option.value?.toLowerCase().includes(term) ||
      option.description?.toLowerCase().includes(term) ||
      option.keywords?.some(keyword => keyword.toLowerCase().includes(term))
    );
  };

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm
    ? options.filter(option =>
      filterFunction
        ? filterFunction(option, searchTerm)
        : defaultFilterFunction(option, searchTerm)
    )
    : options;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event) {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          setSearchTerm('');
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredOptions.length > 0) {
            handleOptionSelect(filteredOptions[0]);
          }
          break;
        default:
          break;
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, filteredOptions]);

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  const handleOptionSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Find selected option
  const selectedOption = options.find(option =>
    option.value === value ||
    (typeof value === 'object' && option.value === value?.value)
  );

  // Render selected value
  const renderSelectedValue = () => {
    if (renderValue && selectedOption) {
      return renderValue(selectedOption);
    }

    if (selectedOption) {
      return (
        <>
          {selectedOption.icon && (
            <PremiumSelectOptionIcon>
              {selectedOption.icon}
            </PremiumSelectOptionIcon>
          )}
          <PremiumSelectOptionText>
            <PremiumSelectOptionLabel>
              {selectedOption.label}
            </PremiumSelectOptionLabel>
            {selectedOption.badge && (
              <PremiumSelectBadge>{selectedOption.badge}</PremiumSelectBadge>
            )}
          </PremiumSelectOptionText>
        </>
      );
    }

    return placeholder;
  };

  // Render individual option
  const renderOptionContent = (option) => {
    if (renderOption) {
      return renderOption(option);
    }

    return (
      <>
        {option.icon && (
          <PremiumSelectOptionIcon>
            {option.icon}
          </PremiumSelectOptionIcon>
        )}
        <PremiumSelectOptionText>
          <PremiumSelectOptionLabel>
            {option.label}
          </PremiumSelectOptionLabel>
          {option.description && (
            <PremiumSelectOptionDescription>
              {option.description}
            </PremiumSelectOptionDescription>
          )}
        </PremiumSelectOptionText>
        {option.badge && (
          <PremiumSelectBadge>{option.badge}</PremiumSelectBadge>
        )}
        {selectedOption?.value === option.value && (
          <PremiumSelectOptionIcon>
            <FiCheck />
          </PremiumSelectOptionIcon>
        )}
      </>
    );
  };

  return (
    <>
      <PremiumSelectWrapper
        ref={selectRef}
        width={width}
        mt={mt}
        mb={mb}
        ml={ml}
        mr={mr}
        className={className}
        {...props}
      >
        <PremiumSelectTrigger
          isOpen={isOpen}
          onClick={handleTriggerClick}
          style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <PremiumSelectValue hasValue={!!selectedOption}>
            {renderSelectedValue()}
          </PremiumSelectValue>
          <PremiumSelectIcon isOpen={isOpen}>
            <FiChevronDown />
          </PremiumSelectIcon>
        </PremiumSelectTrigger>

        {isOpen && (
          <PremiumSelectDropdown isOpen={isOpen}>
            {searchable && (
              <PremiumSelectSearchContainer style={{ position: 'relative' }}>
                <PremiumSelectSearchInput
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </PremiumSelectSearchContainer>
            )}

            <PremiumSelectOptionsList>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <PremiumSelectOption
                    key={option.value || index}
                    isSelected={selectedOption?.value === option.value}
                    onClick={() => handleOptionSelect(option)}
                  >
                    {renderOptionContent(option)}
                  </PremiumSelectOption>
                ))
              ) : (
                <PremiumSelectNoResults>
                  {noResultsText}
                </PremiumSelectNoResults>
              )}
            </PremiumSelectOptionsList>
          </PremiumSelectDropdown>
        )}
      </PremiumSelectWrapper>

      {isOpen && <PremiumSelectOverlay />}
    </>
  );
}

export default PremiumSelect;
