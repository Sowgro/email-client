export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
    id: number
    message: string
    kind: ToastKind
}

export class ToastService {
    public toasts: Toast[] = $state([])
    private nextId = 0

    public show(message: string, kind: ToastKind = 'info', duration = 5000) {
        const toast = {id: ++this.nextId, message, kind}
        this.toasts = [...this.toasts, toast]

        if (duration > 0) {
            window.setTimeout(() => this.dismiss(toast.id), duration)
        }

        return toast.id
    }

    public success(message: string) {
        return this.show(message, 'success')
    }

    public error(message: string) {
        return this.show(message, 'error', 8000)
    }

    public dismiss(id: number) {
        this.toasts = this.toasts.filter((toast) => toast.id !== id)
    }
}
