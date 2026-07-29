<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {AuthService} from "../services/AuthService.svelte";

    const auth: AuthService = getContext(Context.AUTH_SERVICE)
</script>

<div class="wrapper">
    <div class="box">
        <span>Welcome to</span>
        <h1>Fettuccemail</h1>
        <span class="icon">mail</span>
        <h3>Login</h3>
        {#if auth.ready}
            <button onclick={() => auth.signIn()} disabled={auth.busy || Boolean(auth.error?.includes('not configured'))}>
                {auth.busy ? 'Signing in…' : 'Login with Google'}
            </button>
        {:else}
            <button disabled>Loading...</button>
        {/if}
        {#if auth.error}
            <p class="error" role="alert">{auth.error}</p>
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

    .error {
        max-width: 320px;
        color: #ffb4ab;
        font-size: small;
    }
</style>
