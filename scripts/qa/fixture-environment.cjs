// Playwright's env replaces, rather than extends, the inherited environment.
// Retain the standard HOME without forwarding credentials, shell startup flags
// or unrelated configuration variables into the isolated fixture application.
function fixtureEnvironment(values, inherited = process.env) {
  if (Object.hasOwn(values, 'HOME')) throw new Error('Fixture HOME cannot be overridden')
  const standardHome = inherited.HOME
  if (typeof standardHome !== 'string' || !standardHome) throw new Error('Fixture launch requires the standard inherited HOME')
  return { ...values, HOME: standardHome }
}

module.exports = { fixtureEnvironment }
