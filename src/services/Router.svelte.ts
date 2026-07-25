export class Router {
    public url = $state(this.currentUrl())

    private readonly handlePopState = () => {
        this.url = this.currentUrl()
    }

    constructor() {
        window.addEventListener('popstate', this.handlePopState)
    }

    public navigate(url: string, replace = false) {
        if (replace) {
            window.history.replaceState({}, '', url)
        } else {
            window.history.pushState({}, '', url)
        }
        this.url = this.currentUrl()
    }

    public followLink(event: MouseEvent, url: string) {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return
        }

        event.preventDefault()
        this.navigate(url)
    }

    public destroy() {
        window.removeEventListener('popstate', this.handlePopState)
    }

    private currentUrl() {
        return `${window.location.pathname}${window.location.search}`
    }
}
