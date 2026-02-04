/**
 * Welcome Module
 * Handles welcome messages for new members
 */

/**
 * Send welcome message to new member
 * @param {Object} member - Discord guild member
 * @param {Object} client - Discord client
 * @param {Object} config - Bot configuration
 */
export async function sendWelcomeMessage(member, client, config) {
  if (!config.welcome?.enabled || !config.welcome?.channelId) return;

  try {
    const channel = await client.channels.fetch(config.welcome.channelId);
    if (!channel) return;

    const message = (config.welcome.message || 'Welcome, {user}!')
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount.toString());

    await channel.send(message);
    console.log(`[WELCOME] ${member.user.tag} joined ${member.guild.name}`);
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
}
