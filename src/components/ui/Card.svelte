<script>
    export let title = '';
    export let className = '';
  </script>
  
  <div class="bg-white rounded-lg shadow-sm {className}">
    {#if title}
      <div class="border-b p-4">
        <h3 class="text-lg font-semibold">{title}</h3>
      </div>
    {/if}
    <div class="p-4">
      <slot />
    </div>
  </div>