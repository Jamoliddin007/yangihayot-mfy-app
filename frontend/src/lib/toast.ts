export type ToastType = "error" | "success" | "info";

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

type Listener = (toast: ToastMessage) => void;

let listeners: Listener[] = [];
let counter = 0;

export function onToast(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function showToast(text: string, type: ToastType = "info") {
  counter += 1;
  listeners.forEach((l) => l({ id: counter, text, type }));
}
