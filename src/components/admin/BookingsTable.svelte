<script>
  // bookings are now pre-filtered by the parent AdminPanel.svelte
  export let bookings = [];

  // Removed internal filtering props: searchTerm, filterStatus, filterMidwife, filterDateRange
  // Removed internal reactive block $: filteredBookings and $: confirmedBookings
</script>

<div class="bg-white p-6 rounded-lg shadow overflow-hidden">
  <h2 class="text-xl font-bold mb-4 text-gray-700">Confirmed Client Bookings</h2>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[600px]">
      <thead>
        <tr class="bg-gray-50">
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Midwife</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each bookings as booking (booking.id)}
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {new Date(booking.availability.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{booking.availability.startTime}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{booking.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{booking.email}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              <span class="capitalize">{booking.availability.midwife}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
              {#if booking.paid}
                <span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Paid
                </span>
              {:else}
                <span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              {/if}
            </td>
          </tr>
        {/each}
        {#if bookings.length === 0}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500">
              No confirmed bookings found matching your current filters.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>