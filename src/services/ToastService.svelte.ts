export type ToastKind = 'info' | 'success' | 'error'

export interface ToastContent {
    message: string
    error?: string;
    action?: {
        label: string
        fn: () => void,
    }
}

export interface ToastEntry {
    id: number
    kind: ToastKind
    content: ToastContent
}

export class ToastService {
    public toasts: ToastEntry[] = $state([])
    private nextId = 0

    public info = (content: ToastContent) => this.show('info', content)
    public error = (content: ToastContent) => this.show('error', content, 8000)
    public success = (content: ToastContent) => this.show('success', content)

    public show(kind: ToastKind, content: ToastContent, duration = 5000) {
        const toast = {id: ++this.nextId, kind, content}
        this.toasts = [...this.toasts, toast]

        if (duration > 0) {
            window.setTimeout(() => this.dismiss(toast.id), duration)
        }

        return toast.id
    }

    public dismiss(id: number) {
        this.toasts = this.toasts.filter((toast) => toast.id !== id)
    }
}
