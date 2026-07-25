<script lang="ts">
    /*
     * Mostly from:
     * https://developers.google.com/workspace/gmail/api/quickstart/js
     */

    let { loggedIn = $bindable() } = $props()
    let apisLoaded = $state(false)

    // TODO(developer): Set to client ID and API key from the Developer Console
    const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
    const API_KEY = import.meta.env.VITE_API_KEY;

    // Discovery doc URL for APIs used by the quickstart
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

    // Authorization scopes required by the API; multiple scopes can be
    // included, separated by spaces.
    const SCOPES = 'https://www.googleapis.com/auth/gmail.modify';

    let tokenClient: any;
    let gapiInited = false;
    let gisInited = false;

    /**
     * Callback after api.js is loaded.
     */
    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }

    /**
     * Callback after the API client is loaded. Loads the
     * discovery doc to initialize the API.
     */
    async function initializeGapiClient() {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons();
    }

    /**
     * Callback after Google Identity Services are loaded.
     */
    function gisLoaded() {
        // @ts-ignore
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    }

    /**
     *  Sign in the user upon button click.
     */
    function handleAuthClick() {
        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            loggedIn = true;
        };

        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent to share their data
            // when establishing a new session.
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            // Skip display of account chooser and consent dialog for an existing session.
            tokenClient.requestAccessToken({prompt: ''});
        }
    }

    /**
     * Enables user interaction after all libraries are loaded.
     */
    function maybeEnableButtons() {
        if (gapiInited && gisInited) {
            console.log('val: ', gapiInited, gisInited)
            apisLoaded = true;
        }
    }

</script>

<div class="wrapper">
    <div class="box">
        <script async defer src="https://apis.google.com/js/api.js" onload={gapiLoaded}></script>
        <script async defer src="https://accounts.google.com/gsi/client" onload={gisLoaded}></script>
        <span>Welcome to</span>
        <h1>Fettuccemail</h1>
        <span class="icon">mail</span>
        <h3>Login</h3>
        {#if apisLoaded}
            <button onclick={handleAuthClick}>Login with Google</button>
        {:else}
            <button disabled>Loading...</button>
        {/if}
    </div>
</div>


<style>
    .icon {
        font-size: 50px;
        display: flex;
        align-self: center;
    }

    .wrapper {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .box {
        display: flex;
        flex-direction: column;
        background-color: #212121;
        padding: 15px;
        aspect-ratio: 1/1;
    }

    h1 {
        margin: 0;
    }
</style>
