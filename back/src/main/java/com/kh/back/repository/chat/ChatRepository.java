package com.kh.back.repository.chat;


import com.kh.back.entity.chat.Chat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository <Chat, String> {
    @Query(value = "SELECT * FROM chat WHERE room_id = ?1 ORDER BY sent_at ASC LIMIT 50", nativeQuery = true)
    List<Chat> findRecentMsg(String roomId);
    Page<Chat> findAllByOrderByChatId(Pageable pageable);
    Optional<Chat> findByChatId(Long chatId);
}
