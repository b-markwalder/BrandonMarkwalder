const form = document.querySelector("form");
const name = document.getElementById("name");
const email = document.getElementById("email");
const message = document.getElementById("message");
const modal = document.getElementById("modal");
const modalMessage = document.getElementById("modal-message");
const closeModal = document.getElementsByClassName("close")[0];

function sendEmail() {
  const bodyMessage = `Name: ${name.value}<br>Email: ${email.value}<br>Message: ${message.value}`;

  Email.send({
    Host: "smtp.elasticemail.com",
    Username: "markwalder97@hotmail.com",
    Password: "81BACC798A20C5D670BC1AE29CCE98E1DE4F",
    To: 'markwalder97@hotmail.com',
    From: "markwalder97@hotmail.com",
    Subject: "TheMarkwalder New Message",
    Body: bodyMessage
  }).then(
    response => {
      if (response == "OK") {
        showModal("Email sent successfully! ");
      } else {
        showModal("Email failed to send. Try Again :(");
      }
    }
  );
}

function showModal(message) {
  modalMessage.innerText = message;
  modal.style.display = "block";
}

closeModal.onclick = function() {
  modal.style.display = "none";
}

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendEmail();
});