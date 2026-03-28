document.addEventListener("DOMContentLoaded", () => {
  // Star rating functionality
  const starRating = document.querySelector(".star-rating")
  const stars = starRating.querySelectorAll("i")
  const ratingInput = document.getElementById("rating")

  // Handle star hover and click
  stars.forEach((star) => {
    // Hover effect
    star.addEventListener("mouseover", function () {
      const rating = this.getAttribute("data-rating")
      highlightStars(rating)
    })

    // Click to set rating
    star.addEventListener("click", function () {
      const rating = this.getAttribute("data-rating")
      ratingInput.value = rating
      highlightStars(rating)
    })
  })

  // Reset stars when mouse leaves the container
  starRating.addEventListener("mouseleave", () => {
    const currentRating = ratingInput.value
    highlightStars(currentRating)
  })

  // Function to highlight stars
  function highlightStars(rating) {
    stars.forEach((star) => {
      const starRating = star.getAttribute("data-rating")
      if (starRating <= rating) {
        star.classList.remove("far")
        star.classList.add("fas")
      } else {
        star.classList.remove("fas")
        star.classList.add("far")
      }
    })
  }

  // Form submission
  const reviewForm = document.getElementById("reviewForm")
  reviewForm.addEventListener("submit", (e) => {
    e.preventDefault()

    // Validate form
    const name = document.getElementById("name").value
    const rating = ratingInput.value
    const review = document.getElementById("review").value

    if (!name || rating === "0" || !review) {
      alert("Please fill out all fields and provide a rating.")
      return
    }

    // Create new review
    addReview({
      name: name,
      rating: Number.parseInt(rating),
      review: review,
      date: new Date().toLocaleDateString(),
    })

    // Reset form
    reviewForm.reset()
    ratingInput.value = "0"
    highlightStars(0)

    alert("Thank you for your review!")
  })

  // Load existing reviews (normally would be from a database)
  loadReviews()
})

// Function to add a new review to the page
function addReview(reviewData) {
  const reviewsContainer = document.getElementById("reviewsContainer")

  // Create review card
  const reviewCard = document.createElement("div")
  reviewCard.className = "review-card"

  // Create stars HTML
  let starsHTML = ""
  for (let i = 1; i <= 5; i++) {
    if (i <= reviewData.rating) {
      starsHTML += '<i class="fas fa-star"></i>'
    } else {
      starsHTML += '<i class="far fa-star"></i>'
    }
  }

  // Set review card content
  reviewCard.innerHTML = `
        <div class="review-header">
            <span class="reviewer-name">${reviewData.name}</span>
            <span class="review-date">${reviewData.date}</span>
        </div>
        <div class="review-rating">
            ${starsHTML}
        </div>
        <p class="review-content">${reviewData.review}</p>
    `

  // Add to container
  reviewsContainer.prepend(reviewCard)

  // Update local storage (in a real app, this would be sent to a server)
  const reviews = JSON.parse(localStorage.getItem("profileReviews") || "[]")
  reviews.unshift(reviewData)
  localStorage.setItem("profileReviews", JSON.stringify(reviews))
}

// Function to load existing reviews
function loadReviews() {
  const reviewsContainer = document.getElementById("reviewsContainer")

  // Get reviews from local storage (in a real app, this would come from a server)
  const reviews = JSON.parse(localStorage.getItem("profileReviews") || "[]")

  if (reviews.length === 0) {
    reviewsContainer.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to leave a review!</p>'
    return
  }

  // Clear container
  reviewsContainer.innerHTML = ""

  // Add each review
  reviews.forEach((review) => {
    addReview(review)
  })
}
