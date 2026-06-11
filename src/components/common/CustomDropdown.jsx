import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function CustomDropdown({
  value,
  options,
  placeholder = "Select option",
  onChange,
  getOptionLabel,
  getOptionValue,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const resolveOptionLabel = useMemo(() => {
    return getOptionLabel || ((option) => option?.label ?? "");
  }, [getOptionLabel]);

  const resolveOptionValue = useMemo(() => {
    return getOptionValue || ((option) => option?.value ?? "");
  }, [getOptionValue]);

  const selectedOption = useMemo(() => {
    return (
      options.find(
        (option) => String(resolveOptionValue(option) ?? "") === String(value ?? "")
      ) || null
    );
  }, [options, resolveOptionValue, value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideTrigger =
        rootRef.current && rootRef.current.contains(event.target);
      const clickedInsideMenu = menuRef.current && menuRef.current.contains(event.target);

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      return undefined;
    }

    const updatePosition = () => {
      if (!rootRef.current) {
        return;
      }

      const rect = rootRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportPadding = 12;
      const menuWidth = Math.min(rect.width, viewportWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        viewportWidth - menuWidth - viewportPadding
      );

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        width: menuWidth,
        minWidth: menuWidth,
        maxWidth: menuWidth,
        zIndex: 902001,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handleSelect = (option) => {
    onChange?.(resolveOptionValue(option));
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`custom-dropdown${disabled ? " is-disabled" : ""}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="custom-dropdown-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className={`custom-dropdown-value${selectedOption ? "" : " is-placeholder"}`}>
          {selectedOption ? resolveOptionLabel(selectedOption) : placeholder}
        </span>
        <span className="custom-dropdown-caret" aria-hidden="true">
          {open ? "^" : "v"}
        </span>
      </button>

      {open && !disabled
        ? createPortal(
            <div
              ref={menuRef}
              className="custom-dropdown-menu custom-dropdown-menu-portal"
              style={menuStyle}
            >
              {options.length ? (
                options.map((option) => {
                  const optionValue = resolveOptionValue(option);
                  const isSelected = String(optionValue ?? "") === String(value ?? "");

                  return (
                    <button
                      key={String(optionValue)}
                      type="button"
                      className={`custom-dropdown-option${isSelected ? " is-selected" : ""}`}
                      onClick={() => handleSelect(option)}
                    >
                      {resolveOptionLabel(option)}
                    </button>
                  );
                })
              ) : (
                <div className="custom-dropdown-empty">No options</div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default CustomDropdown;
