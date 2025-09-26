import { useState, useCallback } from 'react';

export interface HistoryManager<T> {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (newState: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const useHistory = <T>(initialState: T): HistoryManager<T> => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);

  const state = history[index];

  const setState = useCallback((newState: T) => {
    // Prevent adding duplicate states to the history
    if (JSON.stringify(newState) === JSON.stringify(state)) {
        return;
    }
    
    // When a new state is set, we discard the "redo" history
    const newHistory = history.slice(0, index + 1);
    newHistory.push(newState);
    
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  }, [history, index, state]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prevIndex => prevIndex - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prevIndex => prevIndex + 1);
    }
  }, [index, history.length]);

  const reset = useCallback((newState: T) => {
    setHistory([newState]);
    setIndex(0);
  }, []);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { state, setState, undo, redo, reset, canUndo, canRedo };
};
