import React from 'react';
import PropTypes from 'prop-types';
import Chat from './Chat';

const Friends = ({ user, listOpen, closed }) => {

  const handleChatClose = () => {
    if (closed) {
      closed();
    }
  };

  return (
    <React.Fragment>
      <Chat
        user={user}
        chatOpen={listOpen}
        closed={handleChatClose}
        listOpen={listOpen} // Consider removing if Chat doesn't use it internally
      />
    </React.Fragment>
  );
};

Friends.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    userName: PropTypes.string,
  }),
  listOpen: PropTypes.bool.isRequired,
  closed: PropTypes.func.isRequired,
};

export default Friends;