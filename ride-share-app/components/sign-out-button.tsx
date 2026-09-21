export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="btn-secondary"
      >
        Sign out
      </button>
    </form>
  )
}

