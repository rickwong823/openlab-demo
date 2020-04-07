$(document).ready(() => {
  $('.btn').click(() => {
    $.post(
      `/bank/${customer.bankId}/customer/${customer.customerId}/mobile`,
      { mobile: $('.mobile').val() },
      () => {
        location.reload()
      },
      'application/json'
    )
  })
})