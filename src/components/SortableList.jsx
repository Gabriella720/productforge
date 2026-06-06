import React, { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

const DropIndicator = () => (
  <div className="relative h-2 my-0.5 pointer-events-none" aria-hidden="true">
    <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-brand rounded-full shadow-[0_0_6px_rgba(59,130,246,0.45)]" />
    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand" />
    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand" />
  </div>
);

const getInsertIndex = (fromIndex, index, position) => {
  const insertIndex = position === 'before' ? index : index + 1;
  return fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
};

const SortableList = ({
  items,
  onReorder,
  renderItem,
  className = '',
  itemClassName = '',
  disabled = false,
}) => {
  const dragIndexRef = useRef(null);
  const dropIndicatorRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);

  const finishDrag = () => {
    dragIndexRef.current = null;
    dropIndicatorRef.current = null;
    setDragIndex(null);
    setDropIndicator(null);
  };

  const updateDropIndicator = (index, position) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null) return;

    const next = { index, position };
    const prev = dropIndicatorRef.current;
    if (prev?.index === next.index && prev?.position === next.position) return;

    dropIndicatorRef.current = next;
    setDropIndicator(next);
  };

  const handleDragStart = (event, index) => {
    if (disabled) return;
    event.stopPropagation();
    dragIndexRef.current = index;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (event, index) => {
    if (disabled || dragIndexRef.current === null) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = event.clientY < midpoint ? 'before' : 'after';
    updateDropIndicator(index, position);
  };

  const handleDrop = (event) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const fromIndex = dragIndexRef.current;
    const indicator = dropIndicatorRef.current;
    if (fromIndex === null || !indicator) {
      finishDrag();
      return;
    }

    const toIndex = getInsertIndex(fromIndex, indicator.index, indicator.position);
    if (!Number.isNaN(toIndex) && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    finishDrag();
  };

  const showIndicatorBefore = (index) => (
    dragIndex !== null
    && dropIndicator?.index === index
    && dropIndicator?.position === 'before'
  );

  const showIndicatorAfter = (index) => (
    dragIndex !== null
    && dropIndicator?.index === index
    && dropIndicator?.position === 'after'
  );

  return (
    <div
      className={className}
      onDragOver={(event) => {
        if (disabled || dragIndexRef.current === null) return;
        event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {showIndicatorBefore(index) && <DropIndicator />}
          <div
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={handleDrop}
            className={`${itemClassName} transition-opacity duration-150 ${
              dragIndex === index ? 'opacity-45' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                draggable={!disabled}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnd={finishDrag}
                className={`mt-1 p-2 rounded-lg text-text-muted hover:text-brand hover:bg-brand/5 transition-colors shrink-0 ${
                  disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                }`}
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4 pointer-events-none" />
              </div>
              <div className="flex-1 min-w-0">{renderItem(item, index)}</div>
            </div>
          </div>
          {showIndicatorAfter(index) && <DropIndicator />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SortableList;
