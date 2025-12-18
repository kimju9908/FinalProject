package com.kh.back.controller;

import com.kh.back.dto.python.SearchListResDto;
import com.kh.back.dto.python.SearchResDto;
import com.kh.back.service.python.ElasticService;
import com.kh.back.service.redis.RedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/test")
public class TestController {

	private final RedisService redisService;
	private final ElasticService elasticService;

	@PostMapping("/incr")
	public Long incr() {
		return redisService.incrementLikes("0");
	}

	@GetMapping("/total")
	public Long total() {
		return redisService.getLikes("0");
	}

	@GetMapping("/search")
	public ResponseEntity<List<SearchListResDto>> search(
			@RequestParam(name = "q", required = false, defaultValue = "") String q,
			@RequestParam String type,
			@RequestParam(required = false, defaultValue = "") String category,
			@RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int size
	) {
		return ResponseEntity.ok(
				elasticService.search(q, type, category, null, page, size)
		);
	}

	/**
	 * 상세 조회
	 * ex) GET /test/detail/{id}?type=cocktail
	 */
	@GetMapping("/detail/{id}")
	public ResponseEntity<SearchResDto> detail(
			@PathVariable String id,
			@RequestParam String type
	) {
		return ResponseEntity.ok(elasticService.detail(id, type));
	}
}
