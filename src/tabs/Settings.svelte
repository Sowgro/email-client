<script>
    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium', // short, medium, long, full
        timeStyle: 'short'   // short, medium, long, full
    });
</script>

<div class="panel">
    <div class="settings-panel">
        <h1>Settings</h1>
        <span>Not yet implemented</span>
        <hr>
        <p>{__BUILD_INFO__.branch} {__BUILD_INFO__.commitShort}{__BUILD_INFO__.isDirty && "*"} - {formatter.format(new Date(__BUILD_INFO__.buildTime))}</p>
    </div>
</div>

<style>
    .settings-panel {
        padding: 10px;
        gap: 12px;
    }
</style>
