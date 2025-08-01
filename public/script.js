document.addEventListener("DOMContentLoaded", () => {
  const initialScreen = document.getElementById("initialScreen")
  const revealLetterBtn = document.getElementById("revealLetterBtn")
  const letterContainer = document.getElementById("letterContainer")
  const loveLetterText = document.getElementById("loveLetterText")
  const proposalContainer = document.getElementById("proposalContainer")
  const yesBtn = document.getElementById("yesBtn")
  const noBtn = document.getElementById("noBtn")
  const feedbackTextarea = document.getElementById("feedback")
  const messageContainer = document.getElementById("messageContainer")
  const responseMessage = document.getElementById("responseMessage")

  // Create floating hearts
  createFloatingHearts()

  // Initialize sections
  initialScreen.classList.add("section", "active")
  letterContainer.classList.add("section", "hidden")
  proposalContainer.classList.add("section", "hidden")
  messageContainer.classList.add("section", "hidden")

  const letterContent = `
Gửi Phạm Thị Ngọc Linh,

Anh đã suy nghĩ rất nhiều về những gì anh muốn nói với em. Từ khi chúng ta gặp nhau, cuộc sống của anh đã trở nên tươi đẹp hơn rất nhiều. Mỗi khoảnh khắc ở bên em đều là những kỷ niệm đáng giá mà anh sẽ mãi trân trọng.

Em là một người đặc biệt, với nụ cười làm anh tan chảy, với ánh mắt khiến anh lạc lối, và với trái tim ấm áp luôn biết quan tâm đến người khác. Anh yêu cách em cười, yêu cách em nói và yêu cả những điều nhỏ nhặt nhất về em.

Anh biết rằng tình yêu là một hành trình dài và anh muốn được cùng em đi trên con đường đó. Anh muốn được cùng em chia sẻ mọi niềm vui, nỗi buồn và cùng nhau vượt qua mọi thử thách trong cuộc sống.

Giờ đây, anh đã sẵn sàng để trao trọn trái tim mình cho em.

Với tất cả tình yêu và sự chân thành,
Người yêu em.
`

  let i = 0
  let isTyping = false

  function createFloatingHearts() {
    const heartsContainer = document.createElement("div")
    heartsContainer.className = "hearts"
    document.body.appendChild(heartsContainer)

    setInterval(() => {
      const heart = document.createElement("div")
      heart.className = "heart"
      heart.innerHTML = "♥"
      heart.style.left = Math.random() * 100 + "%"
      heart.style.animationDuration = Math.random() * 3 + 3 + "s"
      heart.style.fontSize = Math.random() * 10 + 15 + "px"
      heartsContainer.appendChild(heart)

      setTimeout(() => {
        heart.remove()
      }, 6000)
    }, 300)
  }

  function smoothTransition(fromElement, toElement, callback) {
    fromElement.classList.add("fade-out")

    setTimeout(() => {
      fromElement.classList.add("hidden")
      fromElement.classList.remove("active", "fade-out")

      toElement.classList.remove("hidden")

      setTimeout(() => {
        toElement.classList.add("active")
        if (callback) callback()
      }, 50)
    }, 400)
  }

  function typeWriter() {
    if (i < letterContent.length && isTyping) {
      loveLetterText.innerHTML += letterContent.charAt(i)
      loveLetterText.classList.add("typing-cursor")
      i++
      letterContainer.scrollTop = letterContainer.scrollHeight
      setTimeout(typeWriter, 50)
    } else if (isTyping) {
      loveLetterText.classList.remove("typing-cursor")
      console.log("Typing finished. Transitioning to proposal in 3 seconds.")
      setTimeout(() => {
        smoothTransition(letterContainer, proposalContainer)
      }, 3000)
    }
  }

  revealLetterBtn.addEventListener("click", () => {
    console.log("Reveal button clicked.")
    revealLetterBtn.innerHTML = '<span class="loading"></span> Đang tải...'
    revealLetterBtn.disabled = true

    setTimeout(() => {
      smoothTransition(initialScreen, letterContainer, () => {
        isTyping = true
        typeWriter()
      })
    }, 1000)
  })

  async function sendResponse(choice) {
    const feedback = feedbackTextarea.value
    const clickedBtn = choice === "yes" ? yesBtn : noBtn

    // Add loading state
    const originalText = clickedBtn.textContent
    clickedBtn.innerHTML = '<span class="loading"></span> Đang gửi...'
    clickedBtn.disabled = true

    try {
      const response = await fetch("/submit-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ choice, feedback }),
      })

      const result = await response.text()

      smoothTransition(proposalContainer, messageContainer, () => {
        responseMessage.textContent = result
        responseMessage.className = response.ok ? "success" : "error"

        // Add confetti effect for yes response
        if (choice === "yes" && response.ok) {
          createConfetti()
        }
      })
    } catch (error) {
      console.error("Error sending data:", error)
      smoothTransition(proposalContainer, messageContainer, () => {
        responseMessage.textContent = "Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại."
        responseMessage.className = "error"
      })
    } finally {
      clickedBtn.innerHTML = originalText
      clickedBtn.disabled = false
    }
  }

  function createConfetti() {
    const colors = ["#ff6b9d", "#c44569", "#4CAF50", "#8bc34a", "#FFD700"]
    const confettiContainer = document.createElement("div")
    confettiContainer.style.position = "fixed"
    confettiContainer.style.top = "0"
    confettiContainer.style.left = "0"
    confettiContainer.style.width = "100%"
    confettiContainer.style.height = "100%"
    confettiContainer.style.pointerEvents = "none"
    confettiContainer.style.zIndex = "1000"
    document.body.appendChild(confettiContainer)

    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement("div")
        confetti.style.position = "absolute"
        confetti.style.width = "10px"
        confetti.style.height = "10px"
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
        confetti.style.left = Math.random() * 100 + "%"
        confetti.style.top = "-10px"
        confetti.style.borderRadius = "50%"
        confetti.style.animation = `confettiFall ${Math.random() * 3 + 2}s linear forwards`
        confettiContainer.appendChild(confetti)

        setTimeout(() => {
          confetti.remove()
        }, 5000)
      }, i * 100)
    }

    setTimeout(() => {
      confettiContainer.remove()
    }, 6000)
  }

  // Add confetti animation to CSS
  const style = document.createElement("style")
  style.textContent = `
        @keyframes confettiFall {
            to {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
            }
        }
    `
  document.head.appendChild(style)

  yesBtn.addEventListener("click", () => {
    sendResponse("yes")
  })

  noBtn.addEventListener("click", () => {
    // Add shake effect to no button
    noBtn.style.animation = "shake 0.5s ease-in-out"
    setTimeout(() => {
      noBtn.style.animation = ""
      sendResponse("no")
    }, 500)
  })

  // Add hover effects for buttons
  ;[yesBtn, noBtn, revealLetterBtn].forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-3px) scale(1.05)"
    })

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = ""
    })
  })

  // Override typeWriter function to prevent multiple calls
  const originalTypeWriter = typeWriter
  typeWriter = () => {
    if (i < letterContent.length && isTyping) {
      loveLetterText.innerHTML += letterContent.charAt(i)
      loveLetterText.classList.add("typing-cursor")

      i++
      letterContainer.scrollTop = letterContainer.scrollHeight
      setTimeout(typeWriter, 50)
    } else if (isTyping) {
      loveLetterText.classList.remove("typing-cursor")
      console.log("Typing finished. Transitioning to proposal in 3 seconds.")
      setTimeout(() => {
        smoothTransition(letterContainer, proposalContainer)
      }, 3000)
    }
  }
})
