<script>
    export let earnings = { yearly: 0 };
    export let bookings = [];
    export let slots = [];
  </script>
  
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white p-6 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-2">Total Earnings</h3>
      <p class="text-3xl font-bold">£{(earnings.yearly / 100).toFixed(2)}</p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-2">Total Bookings</h3>
      <p class="text-3xl font-bold">{bookings.length}</p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-2">Available Slots</h3>
      <p class="text-3xl font-bold">{slots.filter(s => !s.booking).length}</p>
    </div>
  </div>