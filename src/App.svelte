<script lang="ts">
  import Main from "./pages/Main.svelte";
  import Login from "./pages/Login.svelte";

  let loggedIn: boolean = $state(false)
</script>

{#if loggedIn}
  <Main/>
{:else}
  <Login bind:loggedIn={loggedIn}/>
{/if}

