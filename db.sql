CREATE TABLE `Auth` (
  `key` varchar(100) NOT NULL,
  `value` varchar(5000) DEFAULT NULL,
  `count` int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `Mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `string` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `string_UNIQUE` (`string`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

CREATE TABLE `Settings` (
  `key` varchar(100) NOT NULL,
  `value` varchar(5000) DEFAULT NULL,
  `count` int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
