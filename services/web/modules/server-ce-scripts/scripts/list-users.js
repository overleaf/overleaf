const { waitForDb } = require('../../../app/src/infrastructure/mongodb');
const UserGetter = require('../../../app/src/Features/User/UserGetter');

async function main() {
  await waitForDb();

  try {
    const users = await UserGetter.promises.getUsers({}, { _id: 1, email: 1 });
    if (users.length === 0) {
      console.log("No users found.");
    } else {
      users.forEach(user => {
        console.log(`UserID: ${user._id}, Email: ${user.email}`);
      });
    }
  } catch (error) {
    console.error("Error listing users:", error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.error('Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });